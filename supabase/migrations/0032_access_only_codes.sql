-- ============================================================
-- 0032_access_only_codes.sql — Se compra solo con código de acceso
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§3b).
-- Decisión de los owners (2026-11-06): no hay más contraseña general. Para comprar siempre
-- hace falta un código, que se crea en el admin:
--   - personal: para una persona y sus amigos, con un total de entradas (ej. 3).
--   - público (el de las historias): `per_buyer` entradas por persona (1 o más) y un total
--     opcional.
-- "Por persona" se controla en la base, no solo en la pantalla, con tres cosas a la vez:
--   1. la compra no lleva más de `per_buyer` entradas;
--   2. el mismo dispositivo (cookie hm_device) no saca más de `per_buyer` con el código;
--   3. la misma IP no saca más de `per_buyer` × 3 (mucha gente comparte IP: el wifi de una
--      facultad o los datos del celular; con tope 1 se bloquearía a gente real).
-- Más la regla de siempre: una entrada por cédula y una por email por evento.
-- La IP no se guarda tal cual: se guarda su hash (src/lib/access-codes.ts → hashIp).

ALTER TABLE access_codes
  ADD COLUMN IF NOT EXISTS per_buyer integer CHECK (per_buyer BETWEEN 1 AND 20);
-- Los públicos que ya existían eran de 1 entrada por compra.
UPDATE access_codes SET per_buyer = 1 WHERE kind = 'public' AND per_buyer IS NULL;
ALTER TABLE access_codes
  ADD CONSTRAINT access_codes_public_per_buyer CHECK (kind = 'personal' OR per_buyer IS NOT NULL);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS access_device text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS access_ip text;
CREATE INDEX IF NOT EXISTS idx_tickets_access_device ON tickets(access_code_id, access_device) WHERE access_code_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_access_ip ON tickets(access_code_id, access_ip) WHERE access_code_id IS NOT NULL;

-- La contraseña general ya no existe: se borra la guardada y el interruptor.
DELETE FROM site_config WHERE key IN ('gate_password', 'gate_enabled');

-- ------------------------------------------------------------
-- create_order con límite por persona
-- ------------------------------------------------------------
-- Igual que 0029, más p_access_device y p_access_ip. Los conteos son de entradas vivas
-- (en revisión, pagas, usadas o reservadas sin vencer) y se hacen después de crear las de
-- esta compra: si la persona reintenta, su compra anterior sin terminar ya se anuló arriba y
-- no se le cuenta dos veces. Errores: 'access_per_buyer#<primera que sobra>',
-- 'access_device#1', 'access_ip#1'.
DROP FUNCTION IF EXISTS create_order(uuid, uuid, payment_method, integer, uuid, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION create_order(
  p_event_id         uuid,
  p_tier_id          uuid,
  p_payment_method   payment_method,
  p_hold_minutes     integer,
  p_discount_code_id uuid,
  p_presale_code     text,
  p_people           jsonb,
  p_access_code_id   uuid DEFAULT NULL,
  p_access_device    text DEFAULT NULL,
  p_access_ip        text DEFAULT NULL
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
    IF v_code.per_buyer IS NOT NULL AND v_count > v_code.per_buyer THEN
      RAISE EXCEPTION 'access_per_buyer#%', v_code.per_buyer + 1;
    END IF;
  END IF;

  -- Quien vuelve a intentar (el pago no salió, o sacó o cambió a un amigo): su compra anterior
  -- sin terminar se libera ENTERA. Ver 0020.
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

  UPDATE tickets
  SET order_id = v_ids[1],
      access_code_id = p_access_code_id,
      access_device = CASE WHEN p_access_code_id IS NULL THEN NULL ELSE p_access_device END,
      access_ip = CASE WHEN p_access_code_id IS NULL THEN NULL ELSE p_access_ip END
  WHERE id = ANY(v_ids);

  IF p_access_code_id IS NOT NULL THEN
    IF v_code.max_uses IS NOT NULL THEN
      v_used := access_code_uses(p_access_code_id);
      IF v_used > v_code.max_uses THEN
        RAISE EXCEPTION 'access_exhausted#%', greatest(v_code.max_uses - (v_used - v_count), 0) + 1;
      END IF;
    END IF;

    IF v_code.per_buyer IS NOT NULL THEN
      -- Sin dispositivo o sin IP (no debería pasar: la acción siempre los manda) no se
      -- compra con un código que limita por persona.
      IF p_access_device IS NULL OR p_access_ip IS NULL THEN
        RAISE EXCEPTION 'access_device#1';
      END IF;
      SELECT count(*) INTO v_used FROM tickets
      WHERE access_code_id = p_access_code_id AND access_device = p_access_device
        AND (status IN ('review', 'paid', 'used') OR (status = 'pending' AND reserved_until > now()));
      IF v_used > v_code.per_buyer THEN
        RAISE EXCEPTION 'access_device#1';
      END IF;
      SELECT count(*) INTO v_used FROM tickets
      WHERE access_code_id = p_access_code_id AND access_ip = p_access_ip
        AND (status IN ('review', 'paid', 'used') OR (status = 'pending' AND reserved_until > now()));
      IF v_used > v_code.per_buyer * 3 THEN
        RAISE EXCEPTION 'access_ip#1';
      END IF;
    END IF;
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order FROM anon, authenticated, public;
