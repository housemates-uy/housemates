-- ============================================================
-- 0007_door_two_step.sql — Puerta en dos pasos: escanear, cotejar cédula, confirmar
-- ============================================================
-- Antes, escanear marcaba la entrada como usada al instante. Ahora:
--   1. inspect_ticket: el escaneo SOLO consulta. Muestra los datos al portero y no cambia nada.
--   2. El portero pide la cédula:
--        coincide    → check_in_ticket (0006) marca la entrada como usada, atómicamente.
--        no coincide → reject_check_in registra 'id_mismatch'; la entrada sigue válida.
-- Ver docs/LOGICA_DE_NEGOCIO.md → "Puerta".

ALTER TYPE checkin_result ADD VALUE IF NOT EXISTS 'id_mismatch';

-- Devuelve result = 'valid' si la entrada puede pasar, o el motivo del rechazo
-- (mismos valores que checkin_result). Los rechazos quedan registrados en check_ins;
-- el 'valid' no, porque todavía no entró nadie (eso lo registra la confirmación).
CREATE OR REPLACE FUNCTION inspect_ticket(
  p_token     text,
  p_event_id  uuid,
  p_admin_id  uuid,
  p_device    text DEFAULT NULL
) RETURNS TABLE (
  result         text,
  ticket_id      uuid,
  buyer_name     text,
  buyer_document text,
  tier_name      text,
  source         ticket_source,
  used_at        timestamptz
)
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket  tickets%ROWTYPE;
  v_result  text;
  v_door    boolean;
BEGIN
  SELECT door_closed INTO v_door FROM events WHERE id = p_event_id;
  SELECT * INTO v_ticket FROM tickets t WHERE t.qr_token = p_token;

  IF NOT FOUND THEN
    v_result := 'invalid';
  ELSIF v_ticket.event_id <> p_event_id THEN
    v_result := 'wrong_event';
  ELSIF coalesce(v_door, false) THEN
    v_result := 'door_closed';
  ELSIF v_ticket.status = 'used' THEN
    v_result := 'already_used';
  ELSIF v_ticket.status <> 'paid' THEN
    v_result := 'not_paid';
  ELSE
    v_result := 'valid';
  END IF;

  IF v_result <> 'valid' THEN
    INSERT INTO check_ins (ticket_id, event_id, admin_id, result, device_info, scanned_token)
    VALUES (v_ticket.id, p_event_id, p_admin_id, v_result::checkin_result, p_device, left(p_token, 64));
  END IF;

  RETURN QUERY
  SELECT v_result, v_ticket.id, v_ticket.buyer_name, v_ticket.buyer_document,
         (SELECT name FROM ticket_tiers WHERE id = v_ticket.tier_id),
         v_ticket.source, v_ticket.used_at;
END;
$$;

-- El portero vio la cédula y no coincide: queda registrado, la entrada no cambia.
CREATE OR REPLACE FUNCTION reject_check_in(
  p_ticket_id uuid,
  p_event_id  uuid,
  p_admin_id  uuid,
  p_device    text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- plpgsql (no sql): el valor 'id_mismatch' recién se agrega al enum en esta migración
  -- y una función sql lo validaría al crearse, dentro de la misma transacción.
  INSERT INTO check_ins (ticket_id, event_id, admin_id, result, device_info)
  VALUES (p_ticket_id, p_event_id, p_admin_id, 'id_mismatch'::checkin_result, p_device);
END;
$$;

REVOKE EXECUTE ON FUNCTION inspect_ticket, reject_check_in FROM anon, authenticated, public;
