-- ============================================================
-- 0016_security_fixes.sql — Correcciones de seguridad
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§3, §5.2, §5.2b y §6).

-- ------------------------------------------------------------
-- 1. Sin lectura pública de eventos y tandas
-- ------------------------------------------------------------
-- La app lee todo desde el servidor con la service key; con la anon key se podían leer
-- todas las columnas, incluidas ticket_tiers.presale_code (0014) y quantity_sold.
-- Sin policies, RLS deniega todo a anon y authenticated.
DROP POLICY IF EXISTS "eventos_lectura_publica" ON events;
DROP POLICY IF EXISTS "tiers_lectura_publica" ON ticket_tiers;

REVOKE EXECUTE ON FUNCTION tier_available FROM anon, authenticated, public;

-- ------------------------------------------------------------
-- 2. Límite de intentos (compra, códigos, barra y contraseña del gate)
-- ------------------------------------------------------------
-- key = IP de quien pide; action = qué intenta (ver src/lib/rate-limit.ts).
CREATE TABLE rate_limit_hits (
  id          bigserial PRIMARY KEY,
  key         text NOT NULL,
  action      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limit_hits_lookup ON rate_limit_hits (action, key, created_at);
-- Sin policies: solo el servidor (service_role).
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limit_hits FROM anon, authenticated;

-- Registra un intento y devuelve true si ya se pasó del límite (p_max en p_window_seconds).
-- El bloqueo por clave hace que dos pedidos simultáneos no se cuenten como uno. Los
-- intentos rechazados no se registran: así cada clave guarda como mucho p_max filas y el
-- bloqueo se levanta solo cuando vence la ventana.
CREATE OR REPLACE FUNCTION rate_limit_hit(
  p_key             text,
  p_action          text,
  p_window_seconds  int,
  p_max             int
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_since  timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count  int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_action || ':' || p_key));

  DELETE FROM rate_limit_hits WHERE action = p_action AND key = p_key AND created_at < v_since;
  -- Limpieza de claves que no volvieron (ninguna ventana dura más de un día).
  IF random() < 0.01 THEN
    DELETE FROM rate_limit_hits WHERE created_at < now() - interval '1 day';
  END IF;

  SELECT count(*) INTO v_count FROM rate_limit_hits WHERE action = p_action AND key = p_key;
  IF v_count >= p_max THEN RETURN true; END IF;

  INSERT INTO rate_limit_hits (key, action) VALUES (p_key, p_action);
  RETURN false;
END;
$$;

-- ------------------------------------------------------------
-- 3. Una transferencia no se aprueba sin comprobante
-- ------------------------------------------------------------
-- Desde 0016 la entrada nace `pending` con reserva corta y pasa a `review` recién con el
-- comprobante subido (startCheckoutAction). Esto cubre cualquier fila vieja o manual.
CREATE OR REPLACE FUNCTION approve_transfer(p_ticket_id uuid, p_admin_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ticket.status <> 'review' THEN RETURN 'not_in_review'; END IF;
  IF v_ticket.receipt_path IS NULL THEN RETURN 'no_receipt'; END IF;

  UPDATE tickets
  SET status = 'paid', paid_at = now(), reviewed_at = now(), reviewed_by_admin_id = p_admin_id
  WHERE id = p_ticket_id;

  IF v_ticket.tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = quantity_sold + 1 WHERE id = v_ticket.tier_id;
  END IF;

  RETURN 'approved';
END;
$$;

-- ------------------------------------------------------------
-- 4. Confirmar un pago de Mercado Pago solo si cubre el total
-- ------------------------------------------------------------
-- Igual que 0006, más el control del monto (como confirm_bar_order_payment en 0012).
-- Puede ser mayor que el total (cuotas con interés): eso se acepta y queda guardado.
CREATE OR REPLACE FUNCTION confirm_ticket_payment(
  p_ticket_id   uuid,
  p_payment_id  text,
  p_amount      numeric
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ticket.status IN ('paid', 'used') THEN RETURN 'already_paid'; END IF;
  IF v_ticket.status = 'refunded' THEN RETURN 'refunded'; END IF;
  IF p_amount IS NULL OR p_amount < v_ticket.amount_paid_uyu THEN RETURN 'amount_mismatch'; END IF;

  UPDATE tickets
  SET status = 'paid', paid_at = now(), mp_payment_id = p_payment_id,
      amount_paid_uyu = p_amount, reserved_until = NULL, cancelled_at = NULL
  WHERE id = p_ticket_id;

  IF v_ticket.tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = quantity_sold + 1 WHERE id = v_ticket.tier_id;
  END IF;

  RETURN 'confirmed';
END;
$$;

-- Estas funciones solo se llaman desde el servidor con la service key.
REVOKE EXECUTE ON FUNCTION rate_limit_hit, approve_transfer, confirm_ticket_payment
  FROM anon, authenticated, public;
