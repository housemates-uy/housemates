-- ============================================================
-- 0014_tier_features.sql — Tandas: ingreso temprano, próximas y preventa
-- ============================================================
-- Explicación completa en docs/LOGICA_DE_NEGOCIO.md → "Tandas".
--   1. Ingreso temprano: la tanda puede tener "ingreso hasta HH:MM" (más barata). En puerta,
--      si se escanea después, se avisa "Fuera de horario" pero decide el portero; el
--      check-in queda marcado (check_ins.late_entry).
--   2. Próximas: una tanda activa con sales_start en el futuro se muestra con su precio y
--      "Próximamente", y no se puede comprar hasta esa hora (lo controla create_ticket).
--   3. Preventa: una tanda con presale_code no se muestra al público; solo se ve y se
--      compra con el código (link /entradas?preventa=CODIGO). Lo controla create_ticket.

-- ------------------------------------------------------------
-- 1. Columnas nuevas
-- ------------------------------------------------------------
-- entry_until: hora de Montevideo. Cuenta para la noche del evento (ver entry_deadline).
-- presale_code: siempre en mayúsculas (la app lo normaliza); único por evento.
ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS entry_until  time,
  ADD COLUMN IF NOT EXISTS presale_code text CHECK (presale_code ~ '^[A-Z0-9-]{3,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS ticket_tiers_event_presale_code
  ON ticket_tiers (event_id, presale_code)
  WHERE presale_code IS NOT NULL;

-- El portero dejó pasar una entrada de ingreso temprano después de su horario.
ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS late_entry boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. Hasta cuándo vale el ingreso temprano
-- ------------------------------------------------------------
-- "Hasta las 00:30" de una fiesta que arranca a las 23:00 es la madrugada siguiente: se toma
-- la vez de esa hora más cercana al inicio del evento (dentro de ±12 h).
CREATE OR REPLACE FUNCTION entry_deadline(p_entry_until time, p_event_start timestamptz)
RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_entry_until IS NULL THEN NULL
    WHEN d < p_event_start - interval '12 hours' THEN d + interval '1 day'
    WHEN d >= p_event_start + interval '12 hours' THEN d - interval '1 day'
    ELSE d
  END
  FROM (
    SELECT (date_trunc('day', p_event_start AT TIME ZONE 'America/Montevideo') + p_entry_until)
           AT TIME ZONE 'America/Montevideo' AS d
  ) x;
$$;

-- ------------------------------------------------------------
-- 3. create_ticket: preventa y tandas que todavía no salieron
-- ------------------------------------------------------------
-- Parte de la versión de 0010 (estados pending/review/paid, medio de pago y descuento) y
-- suma p_presale_code. Solo para la compra web (source 'purchase'): las entradas manuales
-- las carga un admin y no piden código ni respetan sales_start.
-- Errores nuevos: presale_required (tanda de preventa sin el código correcto) y
-- tier_not_started (sales_start en el futuro).
DROP FUNCTION IF EXISTS create_ticket(uuid, uuid, ticket_source, ticket_status, text, text, text, text, text, text, numeric, text, int, uuid, text, payment_method, uuid, numeric);

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
  p_discount_uyu      numeric DEFAULT 0,
  p_presale_code      text DEFAULT NULL
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
    IF p_source = 'purchase' AND v_tier.presale_code IS NOT NULL
       AND upper(btrim(coalesce(p_presale_code, ''))) <> v_tier.presale_code THEN
      RAISE EXCEPTION 'presale_required';
    END IF;
    IF p_source = 'purchase' AND v_tier.sales_start IS NOT NULL AND v_tier.sales_start > now() THEN
      RAISE EXCEPTION 'tier_not_started';
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
-- 4. Puerta: avisar si una entrada de ingreso temprano llega tarde
-- ------------------------------------------------------------
-- inspect_ticket (0007) suma entry_until y late. late solo avisa: la entrada sigue 'valid'
-- y el portero decide. Cambia lo que devuelve, así que se borra la versión anterior.
DROP FUNCTION IF EXISTS inspect_ticket(text, uuid, uuid, text);

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
  used_at        timestamptz,
  entry_until    time,
  late           boolean
)
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket       tickets%ROWTYPE;
  v_result       text;
  v_door         boolean;
  v_start        timestamptz;
  v_tier_name    text;
  v_entry_until  time;
BEGIN
  SELECT e.door_closed, e.date_start INTO v_door, v_start FROM events e WHERE e.id = p_event_id;
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

  SELECT tt.name, tt.entry_until INTO v_tier_name, v_entry_until
  FROM ticket_tiers tt WHERE tt.id = v_ticket.tier_id;

  RETURN QUERY
  SELECT v_result, v_ticket.id, v_ticket.buyer_name, v_ticket.buyer_document,
         v_tier_name, v_ticket.source, v_ticket.used_at, v_entry_until,
         coalesce(v_result = 'valid' AND now() > entry_deadline(v_entry_until, v_start), false);
END;
$$;

-- check_in_ticket (0006): misma firma; ahora marca late_entry en el check-in.
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
  v_start   timestamptz;
  v_late    boolean := false;
BEGIN
  SELECT e.door_closed, e.date_start INTO v_door, v_start FROM events e WHERE e.id = p_event_id;

  UPDATE tickets t
  SET status = 'used', used_at = now(), used_by_admin_id = p_admin_id
  WHERE t.qr_token = p_token AND t.event_id = p_event_id AND t.status = 'paid'
    AND NOT coalesce(v_door, false)
  RETURNING t.* INTO v_ticket;

  IF FOUND THEN
    v_result := 'admitted';
    SELECT coalesce(now() > entry_deadline(tt.entry_until, v_start), false) INTO v_late
    FROM ticket_tiers tt WHERE tt.id = v_ticket.tier_id;
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

  INSERT INTO check_ins (ticket_id, event_id, admin_id, result, device_info, scanned_token, late_entry)
  VALUES (v_ticket.id, p_event_id, p_admin_id, v_result, p_device, left(p_token, 64), coalesce(v_late, false));

  RETURN QUERY
  SELECT v_result, v_ticket.id, v_ticket.buyer_name, v_ticket.buyer_document,
         (SELECT tt.name FROM ticket_tiers tt WHERE tt.id = v_ticket.tier_id),
         v_ticket.source, v_ticket.used_at;
END;
$$;

-- ------------------------------------------------------------
-- 5. Mail de preventa a quienes vinieron antes
-- ------------------------------------------------------------
-- Un registro por tanda y email (normalizado): "Mandar" va solo a quien no tiene un envío
-- 'sent'; si falló, se reintenta y se actualiza la misma fila.
CREATE TABLE IF NOT EXISTS presale_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id           uuid NOT NULL REFERENCES ticket_tiers(id) ON DELETE CASCADE,
  email_normalized  text NOT NULL,
  email             text NOT NULL,
  status            email_status NOT NULL,
  sent_by_admin_id  uuid REFERENCES admins(id) ON DELETE SET NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier_id, email_normalized)
);
-- Sin policies: solo el servidor (service_role) lee y escribe.
ALTER TABLE presale_sends ENABLE ROW LEVEL SECURITY;

-- A quién le corresponde: un email por persona (normalizado) con una entrada válida o usada
-- de un evento anterior (publicado o archivado, que ya empezó y no es el de la tanda; los
-- borradores no cuentan porque nunca se hicieron). Se saca a quien ya tiene
-- entrada viva para este evento (no puede comprar otra) y a los emails bloqueados en la
-- whitelist. already_sent: ya le llegó el mail de esta tanda.
CREATE OR REPLACE FUNCTION presale_audience(p_tier_id uuid)
RETURNS TABLE (email_normalized text, email text, name text, already_sent boolean)
LANGUAGE sql STABLE AS $$
  WITH tier AS (
    SELECT tt.id, tt.event_id FROM ticket_tiers tt WHERE tt.id = p_tier_id
  ),
  past AS (
    SELECT DISTINCT ON (k.buyer_email_normalized)
           k.buyer_email_normalized, k.buyer_email, k.buyer_name
    FROM tickets k
    JOIN events e ON e.id = k.event_id
    CROSS JOIN tier
    WHERE k.event_id <> tier.event_id
      AND e.status <> 'draft'
      AND e.date_start < now()
      AND k.status IN ('paid', 'used')
    ORDER BY k.buyer_email_normalized, k.created_at DESC
  )
  SELECT p.buyer_email_normalized, p.buyer_email, p.buyer_name,
         EXISTS (
           SELECT 1 FROM presale_sends s
           WHERE s.tier_id = p_tier_id AND s.email_normalized = p.buyer_email_normalized AND s.status = 'sent'
         )
  FROM past p
  CROSS JOIN tier
  WHERE NOT EXISTS (
          SELECT 1 FROM tickets c
          WHERE c.event_id = tier.event_id
            AND c.buyer_email_normalized = p.buyer_email_normalized
            AND (c.status IN ('review', 'paid', 'used') OR (c.status = 'pending' AND c.reserved_until > now()))
        )
    AND NOT EXISTS (
          SELECT 1 FROM whitelist w
          WHERE w.email = p.buyer_email_normalized AND w.status = 'banned'
        )
  ORDER BY p.buyer_email_normalized;
$$;

-- Estas funciones solo se llaman desde el servidor con la service key.
REVOKE EXECUTE ON FUNCTION create_ticket, inspect_ticket, check_in_ticket, entry_deadline, presale_audience
  FROM anon, authenticated, public;
