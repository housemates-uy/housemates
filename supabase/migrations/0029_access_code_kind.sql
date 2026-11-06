-- ============================================================
-- 0029_access_code_kind.sql — Códigos de acceso personales y públicos
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§3b).
-- Personal (como hasta ahora): para una persona y sus amigos, con X entradas.
-- Público (para una historia de Instagram): cada compra lleva una sola entrada, sin amigos.
-- Como hay una entrada por email y una por cédula por evento, cada persona saca como mucho
-- una. El total es opcional: sin tope (max_uses NULL) sirve hasta que se pause, venza o
-- termine el evento. El check de 0021 (1 a 1000) sigue valiendo para el tope.

ALTER TABLE access_codes
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal', 'public'));
ALTER TABLE access_codes ALTER COLUMN max_uses DROP NOT NULL;
ALTER TABLE access_codes
  ADD CONSTRAINT access_codes_personal_max_uses CHECK (kind = 'public' OR max_uses IS NOT NULL);

-- ------------------------------------------------------------
-- create_order con códigos públicos
-- ------------------------------------------------------------
-- Igual que 0021, más dos cosas: un código público no deja comprar más de una entrada
-- ('access_single#2': la persona 2 es la que sobra) y un código sin tope no cuenta usos.
-- Se controla acá y no solo en la pantalla: la acción de compra se puede llamar directo.
CREATE OR REPLACE FUNCTION create_order(
  p_event_id         uuid,
  p_tier_id          uuid,
  p_payment_method   payment_method,
  p_hold_minutes     integer,
  p_discount_code_id uuid,
  p_presale_code     text,
  p_people           jsonb,
  p_access_code_id   uuid DEFAULT NULL
) RETURNS uuid[]
LANGUAGE plpgsql AS $$
DECLARE
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_person jsonb;
  v_n      integer := 0;
  v_result text;
  v_code   access_codes%ROWTYPE;
  v_used   integer;
  v_count  integer;
BEGIN
  IF jsonb_typeof(p_people) <> 'array' OR jsonb_array_length(p_people) = 0 THEN
    RAISE EXCEPTION 'invalid_people';
  END IF;
  v_count := jsonb_array_length(p_people);

  IF p_access_code_id IS NOT NULL THEN
    SELECT * INTO v_code FROM access_codes WHERE id = p_access_code_id FOR UPDATE;
    IF NOT FOUND OR v_code.event_id <> p_event_id OR NOT v_code.active
       OR (v_code.valid_until IS NOT NULL AND v_code.valid_until < now()) THEN
      RAISE EXCEPTION 'access_invalid#1';
    END IF;
    IF v_code.kind = 'public' AND v_count > 1 THEN
      RAISE EXCEPTION 'access_single#2';
    END IF;
  END IF;

  -- Quien vuelve a intentar (el pago no salió, o sacó o cambió a un amigo): su compra anterior
  -- sin terminar se libera ENTERA, no solo la de las personas que repite. Si no, la reserva del
  -- amigo que sacó le sigue ocupando lugar, usos del código de acceso o de descuento y el bus.
  -- La compra anterior es la que tiene como entrada 1 a la misma persona (email o cédula).
  -- Una transferencia en revisión no se toca: ya mandó el comprobante.
  UPDATE tickets SET status = 'cancelled', cancelled_at = now()
  WHERE event_id = p_event_id AND status = 'pending'
    AND order_id IN (
      SELECT t.id FROM tickets t
      WHERE t.event_id = p_event_id AND t.id = t.order_id AND t.status = 'pending'
        AND (t.buyer_email_normalized = p_people->0->>'email_norm' OR t.buyer_document = p_people->0->>'document')
    );

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
        p_instagram        => nullif(v_person->>'instagram', ''),
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

  UPDATE tickets SET order_id = v_ids[1], access_code_id = p_access_code_id WHERE id = ANY(v_ids);

  IF p_access_code_id IS NOT NULL AND v_code.max_uses IS NOT NULL THEN
    v_used := access_code_uses(p_access_code_id);
    IF v_used > v_code.max_uses THEN
      RAISE EXCEPTION 'access_exhausted#%', greatest(v_code.max_uses - (v_used - v_count), 0) + 1;
    END IF;
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order FROM anon, authenticated, public;
