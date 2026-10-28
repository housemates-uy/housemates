-- ============================================================
-- 0012_bar.sql — Barra: carta por evento, pedidos pagos por Mercado Pago y un QR por trago
-- ============================================================
-- La persona arma su pedido en /barra, paga con Mercado Pago y recibe un QR por cada unidad
-- (2 Fernet + 1 Jäger = 3 QRs). Cada QR vale un trago y se entrega una sola vez.
-- Igual que en entradas, lo crítico vive en funciones de Postgres para que sea atómico: el
-- total lo calcula la base con los precios vigentes, y dos barmans escaneando el mismo QR a
-- la vez nunca entregan dos tragos. Explicación completa en docs/LOGICA_DE_NEGOCIO.md → "Barra".

-- ------------------------------------------------------------
-- 1. Pausar la venta de barra de un evento (prendida por defecto)
-- ------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS bar_paused boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. Tipos
-- ------------------------------------------------------------
-- pending: armó el pedido y fue a pagar · paid: Mercado Pago lo aprobó (los QRs valen)
-- cancelled: no se pudo crear el pago · refunded: se devolvió la plata (los QRs no valen)
CREATE TYPE bar_order_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
CREATE TYPE bar_scan_result AS ENUM ('delivered', 'already_delivered', 'invalid', 'wrong_event', 'not_paid');

-- ------------------------------------------------------------
-- 3. Carta: los tragos de cada evento
-- ------------------------------------------------------------
CREATE TABLE bar_products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  description  text,
  price_uyu    numeric(10,2) NOT NULL CHECK (price_uyu > 0),
  active       boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bar_products_event_name ON bar_products (event_id, lower(name));
CREATE INDEX idx_bar_products_event ON bar_products (event_id, sort_order);

CREATE TRIGGER bar_products_updated_at
  BEFORE UPDATE ON bar_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 4. Pedidos
-- ------------------------------------------------------------
-- No hace falta cuenta: alcanza con el email. Si la persona estaba logueada se guarda user_id.
-- access_token: abre la página del pedido (/barra/pedido/<token>) con todos los QRs. Es
-- distinto del token de cada QR, así compartir un QR no expone el pedido entero.
CREATE TABLE bar_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  buyer_email             text NOT NULL,
  buyer_email_normalized  text NOT NULL,
  buyer_name              text,
  user_id                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status                  bar_order_status NOT NULL DEFAULT 'pending',
  total_uyu               numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_uyu >= 0),
  amount_paid_uyu         numeric(10,2),
  access_token            text NOT NULL UNIQUE,
  mp_preference_id        text,
  mp_payment_id           text UNIQUE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  paid_at                 timestamptz,
  cancelled_at            timestamptz
);
CREATE INDEX idx_bar_orders_event_status ON bar_orders (event_id, status);
CREATE INDEX idx_bar_orders_event_email ON bar_orders (event_id, buyer_email_normalized);
CREATE INDEX idx_bar_orders_user ON bar_orders (user_id) WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Unidades: una fila por trago, cada una con su QR
-- ------------------------------------------------------------
-- product_name y unit_price_uyu son una foto del momento de la compra: si después se edita
-- la carta, el pedido no cambia. Pendiente = delivered_at NULL.
CREATE TABLE bar_order_units (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES bar_orders(id) ON DELETE CASCADE,
  event_id               uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  product_id             uuid REFERENCES bar_products(id) ON DELETE SET NULL,
  product_name           text NOT NULL,
  unit_price_uyu         numeric(10,2) NOT NULL CHECK (unit_price_uyu >= 0),
  position               int NOT NULL,
  qr_token               text NOT NULL UNIQUE,
  delivered_at           timestamptz,
  delivered_by_admin_id  uuid REFERENCES admins(id) ON DELETE SET NULL,
  UNIQUE (order_id, position)
);
CREATE INDEX idx_bar_units_event ON bar_order_units (event_id);

-- ------------------------------------------------------------
-- 6. Auditoría de la barra: cada escaneo con "Entregar" y cada rechazo
-- ------------------------------------------------------------
CREATE TABLE bar_scans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  unit_id        uuid REFERENCES bar_order_units(id) ON DELETE SET NULL,
  admin_id       uuid REFERENCES admins(id) ON DELETE SET NULL,
  result         bar_scan_result NOT NULL,
  scanned_token  text,
  device_info    text,
  scanned_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bar_scans_event ON bar_scans (event_id, scanned_at DESC);

-- Sin policies: solo el servidor (service_role) lee y escribe.
ALTER TABLE bar_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_order_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_scans       ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 7. Mails del pedido en email_log
-- ------------------------------------------------------------
-- Un mail de barra no tiene entrada: se registra con bar_order_id.
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'bar_order';
ALTER TABLE email_log ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS bar_order_id uuid REFERENCES bar_orders(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- 8. Crear un pedido
-- ------------------------------------------------------------
-- p_items: [{"product_id": "...", "quantity": 2}, ...] (el mismo trago repetido se suma).
-- p_unit_tokens: un token por unidad, generados por la app (src/lib/tickets.ts →
-- generateQrToken), en el orden en que se crean las unidades.
-- El total lo calcula la base con los precios vigentes: la app nunca manda un precio.
-- Errores (se leen desde la app por el texto del mensaje):
--   bar_closed · bar_paused · empty_order · product_unavailable · invalid_quantity ·
--   too_many · missing_tokens
CREATE OR REPLACE FUNCTION create_bar_order(
  p_event_id      uuid,
  p_email         text,
  p_email_norm    text,
  p_name          text,
  p_user_id       uuid,
  p_access_token  text,
  p_items         jsonb,
  p_unit_tokens   text[]
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_event      events%ROWTYPE;
  v_order_id   uuid;
  v_line       record;
  v_requested  int;
  v_found      int := 0;
  v_units      int := 0;
  v_total      numeric(10,2) := 0;
BEGIN
  -- Se vende mientras el evento esté publicado y no haya terminado (antes o durante la fiesta).
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND OR v_event.status <> 'published' OR v_event.date_end < now() THEN
    RAISE EXCEPTION 'bar_closed';
  END IF;
  IF v_event.bar_paused THEN
    RAISE EXCEPTION 'bar_paused';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_order';
  END IF;
  SELECT count(DISTINCT e->>'product_id') INTO v_requested FROM jsonb_array_elements(p_items) e;

  INSERT INTO bar_orders (event_id, buyer_email, buyer_email_normalized, buyer_name, user_id, access_token)
  VALUES (p_event_id, p_email, p_email_norm, nullif(btrim(p_name), ''), p_user_id, p_access_token)
  RETURNING id INTO v_order_id;

  -- Solo tragos activos de este evento. Si alguno no está, se cancela todo el pedido.
  FOR v_line IN
    SELECT p.id, p.name, p.price_uyu, r.qty
    FROM (
      SELECT (e->>'product_id')::uuid AS product_id, sum((e->>'quantity')::int)::int AS qty
      FROM jsonb_array_elements(p_items) e
      GROUP BY 1
    ) r
    JOIN bar_products p ON p.id = r.product_id AND p.event_id = p_event_id AND p.active
    ORDER BY p.sort_order, p.name
  LOOP
    v_found := v_found + 1;
    IF v_line.qty IS NULL OR v_line.qty < 1 OR v_line.qty > 20 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;
    FOR i IN 1..v_line.qty LOOP
      v_units := v_units + 1;
      IF v_units > 30 THEN
        RAISE EXCEPTION 'too_many';
      END IF;
      IF coalesce(array_length(p_unit_tokens, 1), 0) < v_units THEN
        RAISE EXCEPTION 'missing_tokens';
      END IF;
      INSERT INTO bar_order_units (order_id, event_id, product_id, product_name, unit_price_uyu, position, qr_token)
      VALUES (v_order_id, p_event_id, v_line.id, v_line.name, v_line.price_uyu, v_units, p_unit_tokens[v_units]);
      v_total := v_total + v_line.price_uyu;
    END LOOP;
  END LOOP;

  IF v_found = 0 OR v_found <> v_requested THEN
    RAISE EXCEPTION 'product_unavailable';
  END IF;

  UPDATE bar_orders SET total_uyu = v_total WHERE id = v_order_id;
  RETURN v_order_id;
END;
$$;

-- ------------------------------------------------------------
-- 9. Confirmar el pago (webhook de Mercado Pago, página de vuelta o simulación local)
-- ------------------------------------------------------------
-- Idempotente: la segunda llamada devuelve 'already_paid' y no hace nada.
-- Si Mercado Pago informa un monto menor al total, no se confirma ('amount_mismatch').
CREATE OR REPLACE FUNCTION confirm_bar_order_payment(
  p_order_id    uuid,
  p_payment_id  text DEFAULT NULL,
  p_amount      numeric DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_order bar_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM bar_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_order.status = 'paid' THEN RETURN 'already_paid'; END IF;
  IF v_order.status = 'refunded' THEN RETURN 'refunded'; END IF;
  IF p_amount IS NOT NULL AND p_amount < v_order.total_uyu THEN RETURN 'amount_mismatch'; END IF;

  UPDATE bar_orders
  SET status = 'paid', paid_at = now(), cancelled_at = NULL,
      mp_payment_id = coalesce(p_payment_id, mp_payment_id),
      amount_paid_uyu = coalesce(p_amount, total_uyu)
  WHERE id = p_order_id;

  RETURN 'confirmed';
END;
$$;

-- ------------------------------------------------------------
-- 10. Barra en dos pasos: escanear (solo consulta) y entregar (atómico)
-- ------------------------------------------------------------
-- inspect_bar_unit devuelve result = 'valid' si el trago se puede entregar, o el motivo del
-- rechazo (valores de bar_scan_result). Los rechazos quedan en bar_scans.
CREATE OR REPLACE FUNCTION inspect_bar_unit(
  p_token     text,
  p_event_id  uuid,
  p_admin_id  uuid,
  p_device    text DEFAULT NULL
) RETURNS TABLE (
  result        text,
  unit_id       uuid,
  product_name  text,
  buyer_name    text,
  buyer_email   text,
  delivered_at  timestamptz
)
LANGUAGE plpgsql AS $$
DECLARE
  v_unit    bar_order_units%ROWTYPE;
  v_order   bar_orders%ROWTYPE;
  v_result  text;
BEGIN
  SELECT * INTO v_unit FROM bar_order_units u WHERE u.qr_token = p_token;
  IF NOT FOUND THEN
    v_result := 'invalid';
  ELSE
    SELECT * INTO v_order FROM bar_orders o WHERE o.id = v_unit.order_id;
    IF v_unit.event_id <> p_event_id THEN
      v_result := 'wrong_event';
    ELSIF v_order.status <> 'paid' THEN
      v_result := 'not_paid';
    ELSIF v_unit.delivered_at IS NOT NULL THEN
      v_result := 'already_delivered';
    ELSE
      v_result := 'valid';
    END IF;
  END IF;

  IF v_result <> 'valid' THEN
    INSERT INTO bar_scans (event_id, unit_id, admin_id, result, scanned_token, device_info)
    VALUES (p_event_id, v_unit.id, p_admin_id, v_result::bar_scan_result, left(p_token, 64), p_device);
  END IF;

  RETURN QUERY
  SELECT v_result, v_unit.id, v_unit.product_name, v_order.buyer_name, v_order.buyer_email, v_unit.delivered_at;
END;
$$;

-- Un solo UPDATE ... WHERE delivered_at IS NULL: si dos barmans entregan el mismo QR a la vez,
-- solo uno encuentra la fila pendiente; el otro recibe 'already_delivered' con la hora.
CREATE OR REPLACE FUNCTION deliver_bar_unit(
  p_token     text,
  p_event_id  uuid,
  p_admin_id  uuid,
  p_device    text DEFAULT NULL
) RETURNS TABLE (
  result        text,
  unit_id       uuid,
  product_name  text,
  buyer_name    text,
  buyer_email   text,
  delivered_at  timestamptz
)
LANGUAGE plpgsql AS $$
DECLARE
  v_unit    bar_order_units%ROWTYPE;
  v_order   bar_orders%ROWTYPE;
  v_result  text;
BEGIN
  UPDATE bar_order_units u
  SET delivered_at = now(), delivered_by_admin_id = p_admin_id
  WHERE u.qr_token = p_token AND u.event_id = p_event_id AND u.delivered_at IS NULL
    AND EXISTS (SELECT 1 FROM bar_orders o WHERE o.id = u.order_id AND o.status = 'paid')
  RETURNING u.* INTO v_unit;

  IF FOUND THEN
    v_result := 'delivered';
  ELSE
    SELECT * INTO v_unit FROM bar_order_units u WHERE u.qr_token = p_token;
    IF NOT FOUND THEN
      v_result := 'invalid';
    ELSIF v_unit.event_id <> p_event_id THEN
      v_result := 'wrong_event';
    ELSIF v_unit.delivered_at IS NOT NULL THEN
      v_result := 'already_delivered';
    ELSE
      v_result := 'not_paid';
    END IF;
  END IF;

  SELECT * INTO v_order FROM bar_orders o WHERE o.id = v_unit.order_id;

  INSERT INTO bar_scans (event_id, unit_id, admin_id, result, scanned_token, device_info)
  VALUES (p_event_id, v_unit.id, p_admin_id, v_result::bar_scan_result, left(p_token, 64), p_device);

  RETURN QUERY
  SELECT v_result, v_unit.id, v_unit.product_name, v_order.buyer_name, v_order.buyer_email, v_unit.delivered_at;
END;
$$;

-- ------------------------------------------------------------
-- 11. Resumen por trago (solo pedidos pagos)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION bar_summary(p_event_id uuid)
RETURNS TABLE (
  product_id    uuid,
  product_name  text,
  sold          int,
  delivered     int,
  revenue       numeric
)
LANGUAGE sql STABLE AS $$
  SELECT u.product_id,
         coalesce(max(p.name), max(u.product_name)),
         count(*)::int,
         count(u.delivered_at)::int,
         sum(u.unit_price_uyu)
  FROM bar_order_units u
  JOIN bar_orders o ON o.id = u.order_id AND o.status = 'paid'
  LEFT JOIN bar_products p ON p.id = u.product_id
  WHERE u.event_id = p_event_id
  GROUP BY u.product_id
  ORDER BY min(coalesce(p.sort_order, 2147483647)), 2;
$$;

-- Estas funciones solo se llaman desde el servidor con la service key.
REVOKE EXECUTE ON FUNCTION create_bar_order, confirm_bar_order_payment, inspect_bar_unit, deliver_bar_unit, bar_summary
  FROM anon, authenticated, public;
