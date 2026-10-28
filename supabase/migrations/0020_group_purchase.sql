-- ============================================================
-- 0020_group_purchase.sql — Comprar varias entradas en una compra
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§5.2e).
-- Quien compra puede sumar entradas para sus amigos: cada una nominativa (nombre, cédula y
-- email propios) y cada una le llega a su dueño. Se paga todo junto (un pago de Mercado Pago
-- o una transferencia con un comprobante).
--
-- La compra es un grupo de entradas: tickets.order_id apunta a la entrada de quien compró
-- (la primera, que también apunta a sí misma). Las entradas de antes y las manuales no
-- tienen grupo (NULL): se tratan como un grupo de una.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES tickets(id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id) WHERE order_id IS NOT NULL;

-- Un pago de Mercado Pago ahora paga varias entradas. La idempotencia ya la daban el
-- bloqueo de la entrada y el control de estado, no la unicidad.
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_mp_payment_id_key;

-- Tope de entradas por compra (se cambia desde /admin/config).
INSERT INTO site_config (key, value) VALUES ('max_tickets_per_order', '6') ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 1. Crear la compra
-- ------------------------------------------------------------
-- p_people: una entrada por persona, la de quien compra primero. Cada una:
--   { name, email, email_norm, document, phone, qr_token, amount, discount_uyu,
--     transport_option_id, transport_price }
-- Todo o nada: si una persona falla (cédula repetida, sin lugar, bus lleno…), no queda
-- ninguna entrada creada. El error dice cuál: '<motivo>#<n>' (n = 1 para quien compra).
CREATE OR REPLACE FUNCTION create_order(
  p_event_id         uuid,
  p_tier_id          uuid,
  p_payment_method   payment_method,
  p_hold_minutes     integer,
  p_discount_code_id uuid,
  p_presale_code     text,
  p_people           jsonb
) RETURNS uuid[]
LANGUAGE plpgsql AS $$
DECLARE
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_person jsonb;
  v_n      integer := 0;
  v_result text;
BEGIN
  IF jsonb_typeof(p_people) <> 'array' OR jsonb_array_length(p_people) = 0 THEN
    RAISE EXCEPTION 'invalid_people';
  END IF;

  FOR v_person IN SELECT value FROM jsonb_array_elements(p_people) LOOP
    v_n := v_n + 1;
    BEGIN
      v_id := create_ticket(
        p_event_id         => p_event_id,
        p_tier_id          => p_tier_id,
        p_source           => 'purchase',
        p_status           => 'pending',
        p_name             => v_person->>'name',
        p_email            => v_person->>'email',
        p_email_norm       => v_person->>'email_norm',
        p_document         => v_person->>'document',
        p_phone            => nullif(v_person->>'phone', ''),
        p_instagram        => NULL,
        p_amount           => (v_person->>'amount')::numeric,
        p_qr_token         => v_person->>'qr_token',
        p_hold_minutes     => p_hold_minutes,
        p_payment_method   => p_payment_method,
        p_discount_code_id => p_discount_code_id,
        p_discount_uyu     => coalesce((v_person->>'discount_uyu')::numeric, 0),
        p_presale_code     => p_presale_code
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '%#%', SQLERRM, v_n;
    END;

    IF nullif(v_person->>'transport_option_id', '') IS NOT NULL THEN
      v_result := reserve_transport(v_id, (v_person->>'transport_option_id')::uuid, (v_person->>'transport_price')::numeric);
      IF v_result <> 'reserved' THEN
        RAISE EXCEPTION '%#%', v_result, v_n;
      END IF;
    END IF;

    v_ids := v_ids || v_id;
  END LOOP;

  UPDATE tickets SET order_id = v_ids[1] WHERE id = ANY(v_ids);
  RETURN v_ids;
END;
$$;

-- ------------------------------------------------------------
-- 2. Confirmar el pago de Mercado Pago de una compra
-- ------------------------------------------------------------
-- Misma lógica que confirm_ticket_payment (0017), para todas las entradas del grupo:
--   - ya pagas con este pago → 'already_paid'; pagas con otro → 'duplicate_payment';
--   - monto menor al total del grupo → 'amount_mismatch' (no se confirma nada);
--   - una entrada anulada cuya persona ya tiene otra viva paga o en revisión: queda anulada,
--     con el pago anotado, para devolverle su parte;
--   - una anulada que revive → 'confirmed_late'.
-- Devuelve { result, confirmed: [ids] }: a esas entradas hay que mandarles el mail.
CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_order_id   uuid,
  p_payment_id text,
  p_amount     numeric
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket    tickets%ROWTYPE;
  v_count     integer;
  v_total     numeric;
  v_confirmed uuid[] := '{}';
  v_late      boolean := false;
  v_dup       integer := 0;
BEGIN
  PERFORM 1 FROM tickets WHERE id = p_order_id OR order_id = p_order_id ORDER BY id FOR UPDATE;
  SELECT count(*), coalesce(sum(amount_paid_uyu), 0) INTO v_count, v_total
  FROM tickets WHERE id = p_order_id OR order_id = p_order_id;

  IF v_count = 0 THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF EXISTS (SELECT 1 FROM tickets WHERE (id = p_order_id OR order_id = p_order_id) AND mp_payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('result', 'already_paid');
  END IF;
  IF EXISTS (SELECT 1 FROM tickets WHERE (id = p_order_id OR order_id = p_order_id) AND status IN ('paid', 'used')) THEN
    RETURN jsonb_build_object('result', 'duplicate_payment');
  END IF;
  IF EXISTS (SELECT 1 FROM tickets WHERE (id = p_order_id OR order_id = p_order_id) AND status = 'refunded') THEN
    RETURN jsonb_build_object('result', 'refunded');
  END IF;
  IF p_amount IS NULL OR p_amount < v_total THEN
    RETURN jsonb_build_object('result', 'amount_mismatch');
  END IF;

  FOR v_ticket IN
    SELECT * FROM tickets
    WHERE (id = p_order_id OR order_id = p_order_id) AND status IN ('pending', 'cancelled')
    ORDER BY created_at, id
  LOOP
    PERFORM 1 FROM tickets
    WHERE event_id = v_ticket.event_id AND id <> v_ticket.id
      AND (buyer_email_normalized = v_ticket.buyer_email_normalized OR buyer_document = v_ticket.buyer_document)
      AND status IN ('pending', 'review', 'paid', 'used')
    FOR UPDATE;

    IF EXISTS (
      SELECT 1 FROM tickets
      WHERE event_id = v_ticket.event_id AND id <> v_ticket.id
        AND (buyer_email_normalized = v_ticket.buyer_email_normalized OR buyer_document = v_ticket.buyer_document)
        AND status IN ('review', 'paid', 'used')
    ) THEN
      UPDATE tickets SET mp_payment_id = p_payment_id WHERE id = v_ticket.id;
      v_dup := v_dup + 1;
    ELSE
      UPDATE tickets
      SET status = 'cancelled', cancelled_at = now(), reserved_until = NULL
      WHERE event_id = v_ticket.event_id AND id <> v_ticket.id
        AND (buyer_email_normalized = v_ticket.buyer_email_normalized OR buyer_document = v_ticket.buyer_document)
        AND status = 'pending';

      UPDATE tickets
      SET status = 'paid', paid_at = now(), mp_payment_id = p_payment_id,
          reserved_until = NULL, cancelled_at = NULL,
          -- Una sola entrada: se guarda lo cobrado (cuotas con interés), como antes.
          amount_paid_uyu = CASE WHEN v_count = 1 THEN p_amount ELSE amount_paid_uyu END
      WHERE id = v_ticket.id;

      IF v_ticket.tier_id IS NOT NULL THEN
        UPDATE ticket_tiers SET quantity_sold = quantity_sold + 1 WHERE id = v_ticket.tier_id;
      END IF;

      v_confirmed := v_confirmed || v_ticket.id;
      IF v_ticket.status = 'cancelled' THEN v_late := true; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'result', CASE
      WHEN v_dup > 0 AND cardinality(v_confirmed) = 0 THEN 'duplicate_live_ticket'
      WHEN v_dup > 0 THEN 'partial_duplicate'
      WHEN v_late THEN 'confirmed_late'
      WHEN cardinality(v_confirmed) = 0 THEN 'nothing_to_confirm'
      ELSE 'confirmed'
    END,
    'confirmed', to_jsonb(v_confirmed)
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. Pago pendiente (efectivo, tarjeta en revisión): la reserva del grupo espera
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION extend_order_hold(p_order_id uuid, p_until timestamptz)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE tickets SET reserved_until = p_until
  WHERE (id = p_order_id OR order_id = p_order_id)
    AND status = 'pending'
    AND reserved_until > now()
    AND reserved_until < p_until;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- 4. Devolución total o contracargo desde Mercado Pago
-- ------------------------------------------------------------
-- Anula (reembolsada) cada entrada del grupo pagada con ese pago. Las usadas no se tocan.
-- Devuelve { cancelled: [ids], used: n }.
CREATE OR REPLACE FUNCTION reverse_order_payment(p_order_id uuid, p_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket    tickets%ROWTYPE;
  v_cancelled uuid[] := '{}';
  v_used      integer := 0;
BEGIN
  FOR v_ticket IN
    SELECT * FROM tickets
    WHERE (id = p_order_id OR order_id = p_order_id) AND mp_payment_id = p_payment_id
    ORDER BY id
    FOR UPDATE
  LOOP
    IF v_ticket.status = 'used' THEN
      v_used := v_used + 1;
    ELSIF v_ticket.status = 'paid' AND cancel_ticket(v_ticket.id, true) = 'cancelled' THEN
      v_cancelled := v_cancelled || v_ticket.id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('cancelled', to_jsonb(v_cancelled), 'used', v_used);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order, confirm_order_payment, extend_order_hold, reverse_order_payment
  FROM anon, authenticated, public;
