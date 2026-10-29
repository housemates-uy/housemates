-- ============================================================
-- 0021_access_codes.sql — Códigos de acceso para comprar
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§3b).
-- La venta es selectiva: los owners hablan por Instagram con quien quiere ir y le pasan un
-- código para X entradas (por ejemplo, para ella y sus amigas). Cada entrada que se compra
-- con el código gasta un uso y queda marcada con él, así se ve quién entró con cuál.
-- También sirve para una historia de Instagram: un código con más usos y un vencimiento.

CREATE TABLE IF NOT EXISTS access_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code                text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,16}$'),
  label               text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  max_uses            integer NOT NULL CHECK (max_uses BETWEEN 1 AND 1000),
  valid_until         timestamptz,
  active              boolean NOT NULL DEFAULT true,
  created_by_admin_id uuid REFERENCES admins(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_codes_event ON access_codes(event_id);
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS access_code_id uuid REFERENCES access_codes(id);
CREATE INDEX IF NOT EXISTS idx_tickets_access_code ON tickets(access_code_id) WHERE access_code_id IS NOT NULL;

-- Entradas que ocupan un uso: vivas (en revisión, pagas, usadas) y reservas vigentes, igual
-- que el cupo de las tandas. Una compra que se abandona devuelve el uso cuando vence.
CREATE OR REPLACE FUNCTION access_code_uses(p_code_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::int FROM tickets
  WHERE access_code_id = p_code_id
    AND (status IN ('review', 'paid', 'used') OR (status = 'pending' AND reserved_until > now()));
$$;

-- ------------------------------------------------------------
-- create_order con código de acceso
-- ------------------------------------------------------------
-- Igual que 0020, más p_access_code_id: el código tiene que ser del evento, estar activo y
-- sin vencer, y alcanzar para todas las entradas de la compra. Se bloquea la fila del código,
-- así dos compras no se llevan el último uso. Los usos se cuentan después de crear las
-- entradas: si la persona reintenta, create_ticket ya anuló su reserva anterior y no le
-- descuenta dos veces. Errores: 'access_invalid#1', 'access_exhausted#<primera que no entra>'.
DROP FUNCTION IF EXISTS create_order(uuid, uuid, payment_method, integer, uuid, text, jsonb);

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

  IF p_access_code_id IS NOT NULL THEN
    v_used := access_code_uses(p_access_code_id);
    IF v_used > v_code.max_uses THEN
      RAISE EXCEPTION 'access_exhausted#%', greatest(v_code.max_uses - (v_used - v_count), 0) + 1;
    END IF;
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_order, access_code_uses FROM anon, authenticated, public;
