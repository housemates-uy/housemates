-- ============================================================
-- 0006_ticketing.sql — Entradas, reservas de stock y check-in en puerta
-- ============================================================
-- La lógica de negocio crítica vive en funciones de Postgres para que sea atómica:
-- dos compras simultáneas por el último lugar, o dos porteros escaneando el mismo QR
-- al mismo tiempo, no pueden pisarse. Explicación completa en docs/LOGICA_DE_NEGOCIO.md.

-- ------------------------------------------------------------
-- 1. Columnas nuevas en tickets
-- ------------------------------------------------------------
-- buyer_instagram: requisito del negocio, se revisa a mano quién compró.
-- buyer_email_normalized: clave de unicidad (gmail sin puntos ni +tag). buyer_email
--   guarda lo que escribió la persona, para poder escribirle.
-- reserved_until: mientras una compra está `pending`, el lugar queda reservado hasta acá.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS buyer_instagram        text,
  ADD COLUMN IF NOT EXISTS buyer_email_normalized text,
  ADD COLUMN IF NOT EXISTS reserved_until         timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at           timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_admin_id    uuid REFERENCES admins(id) ON DELETE SET NULL;

UPDATE tickets SET buyer_email_normalized = lower(buyer_email) WHERE buyer_email_normalized IS NULL;
ALTER TABLE tickets ALTER COLUMN buyer_email_normalized SET NOT NULL;

-- ------------------------------------------------------------
-- 2. Unicidad: una entrada por email y una por CI, por evento
-- ------------------------------------------------------------
-- Antes era un UNIQUE sobre toda la tabla: una entrada anulada o una compra abandonada
-- bloqueaba para siempre a esa persona. Ahora solo cuentan las entradas "vivas".
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_event_id_buyer_email_key;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_event_id_buyer_document_key;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_one_per_email
  ON tickets (event_id, buyer_email_normalized)
  WHERE status IN ('pending', 'paid', 'used');

CREATE UNIQUE INDEX IF NOT EXISTS tickets_one_per_document
  ON tickets (event_id, buyer_document)
  WHERE status IN ('pending', 'paid', 'used');

-- ------------------------------------------------------------
-- 3. check_ins: registrar también los QR que no existen
-- ------------------------------------------------------------
ALTER TABLE check_ins ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS event_id      uuid REFERENCES events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scanned_token text;
CREATE INDEX IF NOT EXISTS idx_checkins_event_id ON check_ins(event_id);

-- ------------------------------------------------------------
-- 4. Disponibilidad de una tanda
-- ------------------------------------------------------------
-- Disponibles = total − vendidas − reservas pendientes que todavía no vencieron.
-- quantity_sold cuenta entradas pagas o usadas (no invitaciones: esas no tienen tanda).
CREATE OR REPLACE FUNCTION tier_available(p_tier_id uuid)
RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT t.quantity_total - t.quantity_sold - (
    SELECT count(*)::int FROM tickets k
    WHERE k.tier_id = t.id AND k.status = 'pending' AND k.reserved_until > now()
  )
  FROM ticket_tiers t WHERE t.id = p_tier_id;
$$;

-- ------------------------------------------------------------
-- 5. Crear una entrada (manual, invitación o reserva de compra)
-- ------------------------------------------------------------
-- p_status = 'paid'    → entrada manual (transferencia) o invitación: queda válida ya.
-- p_status = 'pending' → compra web: reserva el lugar p_hold_minutes hasta que pague.
-- Errores (se leen desde la app por el texto del mensaje):
--   tier_inactive · sold_out · duplicate_email · duplicate_document
CREATE OR REPLACE FUNCTION create_ticket(
  p_event_id       uuid,
  p_tier_id        uuid,
  p_source         ticket_source,
  p_status         ticket_status,
  p_name           text,
  p_email          text,
  p_email_norm     text,
  p_document       text,
  p_phone          text,
  p_instagram      text,
  p_amount         numeric,
  p_qr_token       text,
  p_hold_minutes   int DEFAULT NULL,
  p_admin_id       uuid DEFAULT NULL,
  p_notes          text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_tier   ticket_tiers%ROWTYPE;
  v_id     uuid;
BEGIN
  IF p_status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Si la misma persona tenía una compra pendiente para este evento (abandonó el pago
  -- y vuelve a intentar), esa reserva se libera para que no la bloquee.
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

  BEGIN
    INSERT INTO tickets (
      event_id, tier_id, source, status, buyer_name, buyer_email, buyer_email_normalized,
      buyer_document, buyer_phone, buyer_instagram, amount_paid_uyu, qr_token,
      reserved_until, paid_at, created_by_admin_id, notes
    ) VALUES (
      p_event_id, p_tier_id, p_source, p_status, p_name, p_email, p_email_norm,
      p_document, p_phone, p_instagram, p_amount, p_qr_token,
      CASE WHEN p_status = 'pending' THEN now() + make_interval(mins => coalesce(p_hold_minutes, 20)) END,
      CASE WHEN p_status = 'paid' THEN now() END,
      p_admin_id, p_notes
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
-- 6. Confirmar el pago de una compra (lo llama el webhook de Mercado Pago)
-- ------------------------------------------------------------
-- Idempotente: Mercado Pago reintenta el webhook, y además la página de vuelta también
-- confirma. La segunda llamada no hace nada. Si el pago llega después de vencida la
-- reserva (o tras liberarse), se honra igual: la persona pagó. Puede sobrevender por 1
-- en un caso límite; se prefiere eso a cobrar y no dar entrada.
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

-- ------------------------------------------------------------
-- 7. Anular una entrada
-- ------------------------------------------------------------
-- p_refunded = true cuando se devolvió la plata por Mercado Pago (status 'refunded');
-- si no, queda 'cancelled'. Una entrada ya usada en puerta no se puede anular.
CREATE OR REPLACE FUNCTION cancel_ticket(p_ticket_id uuid, p_refunded boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ticket.status = 'used' THEN RETURN 'already_used'; END IF;
  IF v_ticket.status IN ('cancelled', 'refunded') THEN RETURN 'already_cancelled'; END IF;

  UPDATE tickets
  SET status = CASE WHEN p_refunded THEN 'refunded'::ticket_status ELSE 'cancelled'::ticket_status END,
      cancelled_at = now(), reserved_until = NULL
  WHERE id = p_ticket_id;

  IF v_ticket.status = 'paid' AND v_ticket.tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = greatest(quantity_sold - 1, 0) WHERE id = v_ticket.tier_id;
  END IF;

  RETURN 'cancelled';
END;
$$;

-- ------------------------------------------------------------
-- 8. Check-in en puerta
-- ------------------------------------------------------------
-- Un solo viaje a la base por escaneo. El UPDATE ... WHERE status = 'paid' es lo que
-- garantiza un solo uso: si dos celulares escanean el mismo QR a la vez, solo uno
-- encuentra la fila en 'paid'; el otro recibe 'already_used'.
-- Todo intento queda en check_ins (incluidos QR falsos y de otro evento).
CREATE OR REPLACE FUNCTION check_in_ticket(
  p_token     text,
  p_event_id  uuid,
  p_admin_id  uuid,
  p_device    text DEFAULT NULL
) RETURNS TABLE (
  result        checkin_result,
  ticket_id     uuid,
  buyer_name    text,
  buyer_document text,
  tier_name     text,
  source        ticket_source,
  used_at       timestamptz
)
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket  tickets%ROWTYPE;
  v_result  checkin_result;
  v_door    boolean;
BEGIN
  SELECT door_closed INTO v_door FROM events WHERE id = p_event_id;

  UPDATE tickets t
  SET status = 'used', used_at = now(), used_by_admin_id = p_admin_id
  WHERE t.qr_token = p_token AND t.event_id = p_event_id AND t.status = 'paid'
    AND NOT coalesce(v_door, false)
  RETURNING t.* INTO v_ticket;

  IF FOUND THEN
    v_result := 'admitted';
  ELSE
    SELECT * INTO v_ticket FROM tickets t WHERE t.qr_token = p_token;
    IF NOT FOUND THEN
      v_result := 'invalid';
    ELSIF v_ticket.event_id <> p_event_id THEN
      v_result := 'wrong_event';
    ELSIF coalesce(v_door, false) THEN
      v_result := 'door_closed';
    ELSIF v_ticket.status = 'used' THEN
      v_result := 'already_used';
    ELSE
      v_result := 'not_paid';  -- pending, cancelled o refunded
    END IF;
  END IF;

  INSERT INTO check_ins (ticket_id, event_id, admin_id, result, device_info, scanned_token)
  VALUES (v_ticket.id, p_event_id, p_admin_id, v_result, p_device, left(p_token, 64));

  RETURN QUERY
  SELECT v_result, v_ticket.id, v_ticket.buyer_name, v_ticket.buyer_document,
         (SELECT name FROM ticket_tiers WHERE id = v_ticket.tier_id),
         v_ticket.source, v_ticket.used_at;
END;
$$;

-- Estas funciones solo se llaman desde el servidor con la service key.
REVOKE EXECUTE ON FUNCTION create_ticket, confirm_ticket_payment, cancel_ticket, check_in_ticket FROM anon, authenticated, public;
