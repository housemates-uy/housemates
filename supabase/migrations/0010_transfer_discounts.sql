-- ============================================================
-- 0010_transfer_discounts.sql — Pago por transferencia, códigos de descuento y
-- configuración de la venta
-- ============================================================
-- Explicación completa en docs/LOGICA_DE_NEGOCIO.md → "Compra web".

-- ------------------------------------------------------------
-- 1. Medio de pago
-- ------------------------------------------------------------
CREATE TYPE payment_method AS ENUM ('mercadopago', 'transfer');

-- ------------------------------------------------------------
-- 2. Códigos de descuento (uno o más por evento)
-- ------------------------------------------------------------
-- kind = 'percent' → value es el % (1 a 100) · kind = 'fixed' → value son pesos.
-- max_uses NULL = sin tope. Un uso es una entrada viva con ese código (pendiente de pago,
-- en revisión, paga o usada): si se anula, el uso se libera.
CREATE TABLE discount_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('percent', 'fixed')),
  value        numeric(10,2) NOT NULL CHECK (value > 0),
  max_uses     int CHECK (max_uses IS NULL OR max_uses > 0),
  valid_until  timestamptz,
  active       boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'percent' OR value <= 100)
);
CREATE UNIQUE INDEX discount_codes_event_code ON discount_codes (event_id, upper(code));
-- Sin policies: solo el servidor (service_role) lee y escribe.
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. Columnas nuevas en tickets
-- ------------------------------------------------------------
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS payment_method        payment_method,
  ADD COLUMN IF NOT EXISTS discount_code_id      uuid REFERENCES discount_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_uyu          numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_path          text,
  ADD COLUMN IF NOT EXISTS reviewed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_id  uuid REFERENCES admins(id) ON DELETE SET NULL;

UPDATE tickets SET payment_method = 'mercadopago'
WHERE source = 'purchase' AND payment_method IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_discount_code ON tickets(discount_code_id) WHERE discount_code_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Una entrada por persona: "en revisión" también cuenta como viva
-- ------------------------------------------------------------
DROP INDEX IF EXISTS tickets_one_per_email;
CREATE UNIQUE INDEX tickets_one_per_email
  ON tickets (event_id, buyer_email_normalized)
  WHERE status IN ('pending', 'review', 'paid', 'used');

DROP INDEX IF EXISTS tickets_one_per_document;
CREATE UNIQUE INDEX tickets_one_per_document
  ON tickets (event_id, buyer_document)
  WHERE status IN ('pending', 'review', 'paid', 'used');

-- ------------------------------------------------------------
-- 5. Disponibilidad: las transferencias en revisión también ocupan lugar
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION tier_available(p_tier_id uuid)
RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT t.quantity_total - t.quantity_sold - (
    SELECT count(*)::int FROM tickets k
    WHERE k.tier_id = t.id
      AND ((k.status = 'pending' AND k.reserved_until > now()) OR k.status = 'review')
  )
  FROM ticket_tiers t WHERE t.id = p_tier_id;
$$;

-- Usos vivos de un código (mismo criterio que la disponibilidad).
CREATE OR REPLACE FUNCTION discount_code_uses(p_code_id uuid)
RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM tickets k
  WHERE k.discount_code_id = p_code_id
    AND ((k.status = 'pending' AND k.reserved_until > now()) OR k.status IN ('review', 'paid', 'used'));
$$;

-- ------------------------------------------------------------
-- 6. create_ticket: estado 'review', medio de pago y código de descuento
-- ------------------------------------------------------------
-- Cambia la firma, así que se borra la anterior (si no, quedarían dos versiones).
-- Errores nuevos: discount_invalid (no existe, inactivo, vencido o de otro evento) y
-- discount_exhausted (sin usos). El monto del descuento lo calcula la app
-- (src/lib/pricing.ts); acá se garantiza que el código se pueda usar, sin carreras.
DROP FUNCTION IF EXISTS create_ticket(uuid, uuid, ticket_source, ticket_status, text, text, text, text, text, text, numeric, text, int, uuid, text);

CREATE OR REPLACE FUNCTION create_ticket(
  p_event_id          uuid,
  p_tier_id           uuid,
  p_source            ticket_source,
  p_status            ticket_status,
  p_name              text,
  p_email             text,
  p_email_norm        text,
  p_document          text,
  p_phone             text,
  p_instagram         text,
  p_amount            numeric,
  p_qr_token          text,
  p_hold_minutes      int DEFAULT NULL,
  p_admin_id          uuid DEFAULT NULL,
  p_notes             text DEFAULT NULL,
  p_payment_method    payment_method DEFAULT NULL,
  p_discount_code_id  uuid DEFAULT NULL,
  p_discount_uyu      numeric DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_tier   ticket_tiers%ROWTYPE;
  v_code   discount_codes%ROWTYPE;
  v_id     uuid;
BEGIN
  IF p_status NOT IN ('pending', 'review', 'paid') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Si la misma persona tenía una compra con Mercado Pago sin terminar para este evento
  -- (abandonó el pago y vuelve a intentar), esa reserva se libera para que no la bloquee.
  -- Una transferencia en revisión NO se libera: ya mandó el comprobante.
  UPDATE tickets SET status = 'cancelled', cancelled_at = now()
  WHERE event_id = p_event_id AND status = 'pending'
    AND (buyer_email_normalized = p_email_norm OR buyer_document = p_document);

  IF p_tier_id IS NOT NULL THEN
    -- FOR UPDATE: bloquea la fila de la tanda hasta terminar. Dos compras simultáneas
    -- por el último lugar se resuelven en fila, nunca las dos a la vez.
    SELECT * INTO v_tier FROM ticket_tiers WHERE id = p_tier_id AND event_id = p_event_id FOR UPDATE;
    IF NOT FOUND OR NOT v_tier.active THEN
      RAISE EXCEPTION 'tier_inactive';
    END IF;
    -- Las entradas manuales (ya cobradas por transferencia) ignoran el "agotado manual",
    -- pero respetan el stock real.
    IF (p_source = 'purchase' AND v_tier.sold_out_override) OR tier_available(p_tier_id) <= 0 THEN
      RAISE EXCEPTION 'sold_out';
    END IF;
  END IF;

  IF p_discount_code_id IS NOT NULL THEN
    -- Mismo bloqueo para el código: el último uso no se lo llevan dos personas.
    SELECT * INTO v_code FROM discount_codes WHERE id = p_discount_code_id FOR UPDATE;
    IF NOT FOUND OR v_code.event_id <> p_event_id OR NOT v_code.active
       OR (v_code.valid_until IS NOT NULL AND v_code.valid_until < now()) THEN
      RAISE EXCEPTION 'discount_invalid';
    END IF;
    IF v_code.max_uses IS NOT NULL AND discount_code_uses(p_discount_code_id) >= v_code.max_uses THEN
      RAISE EXCEPTION 'discount_exhausted';
    END IF;
  END IF;

  BEGIN
    INSERT INTO tickets (
      event_id, tier_id, source, status, buyer_name, buyer_email, buyer_email_normalized,
      buyer_document, buyer_phone, buyer_instagram, amount_paid_uyu, qr_token,
      reserved_until, paid_at, created_by_admin_id, notes,
      payment_method, discount_code_id, discount_uyu
    ) VALUES (
      p_event_id, p_tier_id, p_source, p_status, p_name, p_email, p_email_norm,
      p_document, p_phone, p_instagram, p_amount, p_qr_token,
      CASE WHEN p_status = 'pending' THEN now() + make_interval(mins => coalesce(p_hold_minutes, 20)) END,
      CASE WHEN p_status = 'paid' THEN now() END,
      p_admin_id, p_notes,
      p_payment_method, p_discount_code_id, coalesce(p_discount_uyu, 0)
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM LIKE '%tickets_one_per_email%' THEN RAISE EXCEPTION 'duplicate_email'; END IF;
    IF SQLERRM LIKE '%tickets_one_per_document%' THEN RAISE EXCEPTION 'duplicate_document'; END IF;
    RAISE;
  END;

  IF p_status = 'paid' AND p_tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = quantity_sold + 1 WHERE id = p_tier_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ------------------------------------------------------------
-- 7. Validar una transferencia (solo owners, desde el admin)
-- ------------------------------------------------------------
-- Aprobar: la entrada pasa a 'paid' y suma a la tanda. Rechazar: pasa a 'cancelled' y el
-- lugar se libera solo (una entrada en revisión nunca sumó a quantity_sold).
CREATE OR REPLACE FUNCTION approve_transfer(p_ticket_id uuid, p_admin_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ticket.status <> 'review' THEN RETURN 'not_in_review'; END IF;

  UPDATE tickets
  SET status = 'paid', paid_at = now(), reviewed_at = now(), reviewed_by_admin_id = p_admin_id
  WHERE id = p_ticket_id;

  IF v_ticket.tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = quantity_sold + 1 WHERE id = v_ticket.tier_id;
  END IF;

  RETURN 'approved';
END;
$$;

CREATE OR REPLACE FUNCTION reject_transfer(p_ticket_id uuid, p_admin_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ticket.status <> 'review' THEN RETURN 'not_in_review'; END IF;

  UPDATE tickets
  SET status = 'cancelled', cancelled_at = now(), reviewed_at = now(), reviewed_by_admin_id = p_admin_id
  WHERE id = p_ticket_id;

  RETURN 'rejected';
END;
$$;

-- Estas funciones solo se llaman desde el servidor con la service key.
REVOKE EXECUTE ON FUNCTION create_ticket, approve_transfer, reject_transfer, discount_code_uses
  FROM anon, authenticated, public;

-- ------------------------------------------------------------
-- 8. Comprobantes: bucket privado (solo el servidor los sube y genera links temporales)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes', 'comprobantes', false, 4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 9. Configuración de la venta (se cambia desde /admin/config)
-- ------------------------------------------------------------
-- gate_enabled: '1' pide la contraseña para comprar (arranca prendida); '0' entra cualquiera.
-- transfer_details: texto libre con los datos de la cuenta (banco, titular, número).
INSERT INTO site_config (key, value) VALUES
  ('gate_enabled',         '1'),
  ('pay_mp_enabled',       '1'),
  ('pay_transfer_enabled', '1'),
  ('transfer_details',     '')
ON CONFLICT (key) DO NOTHING;
