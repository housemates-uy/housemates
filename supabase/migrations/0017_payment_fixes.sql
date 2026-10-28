-- ============================================================
-- 0017_payment_fixes.sql — Pagos de Mercado Pago que llegan tarde, repetidos o revertidos
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§5.2).

-- Aviso a los owners por un pago que hay que revisar a mano (una vez por entrada).
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'payment_alert';

-- ------------------------------------------------------------
-- 1. Confirmar el pago
-- ------------------------------------------------------------
-- Antes, si la persona reintentaba la compra mientras MP procesaba el primer pago, la
-- reserva pagada ya estaba anulada y la nueva ocupaba su email y su CI: el UPDATE chocaba
-- con tickets_one_per_email y el pago quedaba sin entrada.
-- Ahora:
--   - si la otra entrada viva está sin pagar (pending), se anula esa y vale la pagada;
--   - si ya está paga o en revisión, el pago queda anotado en la anulada para devolverlo
--     ('duplicate_live_ticket');
--   - un segundo pago sobre una entrada ya paga se informa ('duplicate_payment');
--   - si revive una entrada anulada, devuelve 'confirmed_late' para avisar a los owners.
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
  IF v_ticket.status IN ('paid', 'used') THEN
    IF v_ticket.mp_payment_id IS DISTINCT FROM p_payment_id THEN RETURN 'duplicate_payment'; END IF;
    RETURN 'already_paid';
  END IF;
  IF v_ticket.status = 'refunded' THEN RETURN 'refunded'; END IF;
  IF p_amount IS NULL OR p_amount < v_ticket.amount_paid_uyu THEN RETURN 'amount_mismatch'; END IF;

  PERFORM 1 FROM tickets
  WHERE event_id = v_ticket.event_id
    AND id <> v_ticket.id
    AND (buyer_email_normalized = v_ticket.buyer_email_normalized OR buyer_document = v_ticket.buyer_document)
    AND status IN ('pending', 'review', 'paid', 'used')
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM tickets
    WHERE event_id = v_ticket.event_id
      AND id <> v_ticket.id
      AND (buyer_email_normalized = v_ticket.buyer_email_normalized OR buyer_document = v_ticket.buyer_document)
      AND status IN ('review', 'paid', 'used')
  ) THEN
    UPDATE tickets SET mp_payment_id = p_payment_id WHERE id = p_ticket_id AND mp_payment_id IS NULL;
    RETURN 'duplicate_live_ticket';
  END IF;

  UPDATE tickets
  SET status = 'cancelled', cancelled_at = now(), reserved_until = NULL
  WHERE event_id = v_ticket.event_id
    AND id <> v_ticket.id
    AND (buyer_email_normalized = v_ticket.buyer_email_normalized OR buyer_document = v_ticket.buyer_document)
    AND status = 'pending';

  UPDATE tickets
  SET status = 'paid', paid_at = now(), mp_payment_id = p_payment_id,
      amount_paid_uyu = p_amount, reserved_until = NULL, cancelled_at = NULL
  WHERE id = p_ticket_id;

  IF v_ticket.tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = quantity_sold + 1 WHERE id = v_ticket.tier_id;
  END IF;

  -- Revivió una entrada anulada (la anuló un admin o la persona reintentó): vale igual,
  -- pero se avisa a los owners porque puede pasarse del cupo.
  RETURN CASE WHEN v_ticket.status = 'cancelled' THEN 'confirmed_late' ELSE 'confirmed' END;
END;
$$;

-- ------------------------------------------------------------
-- 2. Pago en efectivo o en revisión: la reserva espera al pago
-- ------------------------------------------------------------
-- Un cupón de Abitab/RedPagos se paga después de los 20 minutos de la reserva. Cuando MP
-- avisa que el pago quedó pendiente, la reserva se estira hasta que vence el cupón, así el
-- lugar no se vende dos veces. Solo se estira una reserva que sigue viva.
CREATE OR REPLACE FUNCTION extend_ticket_hold(p_ticket_id uuid, p_until timestamptz)
RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tickets SET reserved_until = p_until
  WHERE id = p_ticket_id
    AND status = 'pending'
    AND reserved_until > now()
    AND reserved_until < p_until;
  RETURN CASE WHEN FOUND THEN 'extended' ELSE 'unchanged' END;
END;
$$;

-- ------------------------------------------------------------
-- 3. Devolución o contracargo hechos desde Mercado Pago
-- ------------------------------------------------------------
-- Solo anula la entrada que se pagó con ese pago (una devolución de un pago repetido no
-- toca la entrada válida).
CREATE OR REPLACE FUNCTION reverse_ticket_payment(p_ticket_id uuid, p_payment_id text)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_ticket.mp_payment_id IS DISTINCT FROM p_payment_id THEN RETURN 'ignored'; END IF;
  IF v_ticket.status = 'used' THEN RETURN 'already_used'; END IF;
  IF v_ticket.status <> 'paid' THEN RETURN 'ignored'; END IF;
  RETURN cancel_ticket(p_ticket_id, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION extend_ticket_hold, reverse_ticket_payment FROM anon, authenticated, public;
