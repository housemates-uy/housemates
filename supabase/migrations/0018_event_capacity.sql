-- ============================================================
-- 0018_event_capacity.sql — La capacidad del evento limita la venta
-- ============================================================
-- Antes, events.capacity solo se mostraba: el único tope era el cupo de cada tanda, y si la
-- suma de las tandas pasaba la capacidad se vendía de más. Explicación en
-- docs/LOGICA_DE_NEGOCIO.md (§4).

-- Lugares libres del evento: capacidad menos entradas vivas (pagas, usadas, en revisión y
-- reservas vigentes), invitaciones incluidas.
CREATE OR REPLACE FUNCTION event_available(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT e.capacity - (
    SELECT count(*)::int FROM tickets k
    WHERE k.event_id = e.id
      AND (k.status IN ('review', 'paid', 'used') OR (k.status = 'pending' AND k.reserved_until > now()))
  )
  FROM events e WHERE e.id = p_event_id;
$$;

REVOKE EXECUTE ON FUNCTION event_available FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION create_ticket(p_event_id uuid, p_tier_id uuid, p_source ticket_source, p_status ticket_status, p_name text, p_email text, p_email_norm text, p_document text, p_phone text, p_instagram text, p_amount numeric, p_qr_token text, p_hold_minutes integer DEFAULT NULL::integer, p_admin_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_payment_method payment_method DEFAULT NULL::payment_method, p_discount_code_id uuid DEFAULT NULL::uuid, p_discount_uyu numeric DEFAULT 0, p_presale_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $$
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

  -- Capacidad del evento: tope de toda la fiesta, además del cupo de cada tanda. Las
  -- invitaciones no se frenan, pero cuentan. La fila del evento se bloquea para que dos
  -- compras no se lleven el último lugar.
  IF p_tier_id IS NOT NULL THEN
    PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;
    IF event_available(p_event_id) <= 0 THEN
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
