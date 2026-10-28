-- ============================================================
-- 0015_transport.sql — Transporte (bus) en la compra de la entrada
-- ============================================================
-- La fiesta es fuera de Montevideo: al comprar, la persona puede sumar un lugar en el bus
-- ("Ida", "Vuelta", "Ida y vuelta"...). Cada evento tiene sus opciones, que cargan los
-- owners desde Admin → evento → Transporte. Explicación en docs/LOGICA_DE_NEGOCIO.md →
-- "Transporte".
--   - El precio del bus se suma al total de la entrada (amount_paid_uyu guarda todo).
--   - El cupo cuenta solo entradas vivas: si la entrada se anula, se rechaza la
--     transferencia o vence la reserva de Mercado Pago, el lugar del bus se libera solo.
--   - La reserva del lugar se hace después de crear la entrada (reserve_transport), con la
--     opción bloqueada, igual que la tanda en create_ticket.

-- ------------------------------------------------------------
-- 1. Opciones de transporte de cada evento
-- ------------------------------------------------------------
-- departure: texto libre con el punto y el horario de salida (y de vuelta, si aplica).
-- capacity NULL = sin cupo.
CREATE TABLE transport_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  departure   text NOT NULL CHECK (length(btrim(departure)) BETWEEN 1 AND 300),
  price_uyu   numeric(10,2) NOT NULL CHECK (price_uyu > 0),
  capacity    int CHECK (capacity IS NULL OR capacity > 0),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX transport_options_event_name ON transport_options (event_id, lower(name));
CREATE INDEX idx_transport_options_event ON transport_options (event_id, created_at);

CREATE TRIGGER transport_options_updated_at
  BEFORE UPDATE ON transport_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 2. El transporte elegido con cada entrada (uno por entrada)
-- ------------------------------------------------------------
-- price_uyu es una foto del momento de la compra: si después cambia el precio de la opción,
-- la entrada no cambia. Una opción con pasajeros no se puede borrar (RESTRICT): se desactiva.
CREATE TABLE ticket_transport (
  ticket_id   uuid PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES transport_options(id) ON DELETE RESTRICT,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  price_uyu   numeric(10,2) NOT NULL CHECK (price_uyu >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_transport_option ON ticket_transport (option_id);
CREATE INDEX idx_ticket_transport_event ON ticket_transport (event_id);

-- Sin policies: solo el servidor (service_role) lee y escribe.
ALTER TABLE transport_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_transport  ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. Lugares ocupados de una opción
-- ------------------------------------------------------------
-- Mismo criterio que la disponibilidad de la tanda: compra con Mercado Pago sin vencer,
-- transferencia en revisión, paga o usada.
CREATE OR REPLACE FUNCTION transport_seats_taken(p_option_id uuid)
RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT count(*)::int
  FROM ticket_transport r
  JOIN tickets k ON k.id = r.ticket_id
  WHERE r.option_id = p_option_id
    AND ((k.status = 'pending' AND k.reserved_until > now()) OR k.status IN ('review', 'paid', 'used'));
$$;

-- ------------------------------------------------------------
-- 4. Reservar el lugar en el bus para una entrada recién creada
-- ------------------------------------------------------------
-- Se llama justo después de create_ticket, antes de subir el comprobante o de ir a pagar.
-- p_price: el precio con el que se calculó el total; si la opción cambió de precio en el
-- medio, no se reserva (el total ya no cerraría con lo cobrado).
-- Devuelve 'reserved' o el motivo: transport_inactive · transport_changed · transport_full
-- · ticket_not_found. Si no se pudo reservar, la entrada recién creada se borra en la misma
-- transacción (todavía no tiene pago ni comprobante): sin bus no hay compra.
CREATE OR REPLACE FUNCTION reserve_transport(
  p_ticket_id  uuid,
  p_option_id  uuid,
  p_price      numeric
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket  tickets%ROWTYPE;
  v_option  transport_options%ROWTYPE;
  v_result  text;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'ticket_not_found'; END IF;

  -- FOR UPDATE: bloquea la opción hasta terminar. Dos compras por el último lugar del bus
  -- se resuelven en fila, nunca las dos a la vez.
  SELECT * INTO v_option FROM transport_options WHERE id = p_option_id FOR UPDATE;
  IF NOT FOUND OR v_option.event_id <> v_ticket.event_id OR NOT v_option.active THEN
    v_result := 'transport_inactive';
  ELSIF v_option.price_uyu <> p_price THEN
    v_result := 'transport_changed';
  ELSIF v_option.capacity IS NOT NULL AND transport_seats_taken(p_option_id) >= v_option.capacity THEN
    v_result := 'transport_full';
  ELSE
    INSERT INTO ticket_transport (ticket_id, option_id, event_id, price_uyu)
    VALUES (p_ticket_id, p_option_id, v_ticket.event_id, v_option.price_uyu);
    RETURN 'reserved';
  END IF;

  DELETE FROM tickets
  WHERE id = p_ticket_id
    AND source = 'purchase'
    AND status IN ('pending', 'review')
    AND mp_payment_id IS NULL
    AND receipt_path IS NULL
    AND paid_at IS NULL;
  RETURN v_result;
END;
$$;

-- Estas funciones solo se llaman desde el servidor con la service key.
REVOKE EXECUTE ON FUNCTION transport_seats_taken, reserve_transport FROM anon, authenticated, public;
