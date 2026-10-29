-- ============================================================
-- 0027_bar_payment_checks.sql — Pagos de barra que no sirven
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md (§5.7 Barra).
-- confirm_bar_order_payment ahora distingue dos casos que antes pasaban en silencio:
-- - 'duplicate_payment': el pedido ya estaba pago con OTRO pago de Mercado Pago (dos pestañas,
--   dos pagos). No se toca el pedido; la app avisa a los owners para devolver el segundo.
-- - 'event_ended': el pago llega con la fiesta terminada (por ejemplo, una tarjeta que quedó en
--   revisión). Ya no hay trago posible: el pedido no se confirma y la app avisa a los owners.
-- El resto queda igual que en 0012.

CREATE OR REPLACE FUNCTION confirm_bar_order_payment(
  p_order_id    uuid,
  p_payment_id  text DEFAULT NULL,
  p_amount      numeric DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_order bar_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM bar_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_order.status = 'paid' THEN
    IF p_payment_id IS NOT NULL AND v_order.mp_payment_id IS NOT NULL AND v_order.mp_payment_id <> p_payment_id THEN
      RETURN 'duplicate_payment';
    END IF;
    RETURN 'already_paid';
  END IF;
  IF v_order.status = 'refunded' THEN RETURN 'refunded'; END IF;
  IF p_amount IS NOT NULL AND p_amount < v_order.total_uyu THEN RETURN 'amount_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM events WHERE id = v_order.event_id AND date_end < now()) THEN
    RETURN 'event_ended';
  END IF;

  UPDATE bar_orders
  SET status = 'paid', paid_at = now(), cancelled_at = NULL,
      mp_payment_id = coalesce(p_payment_id, mp_payment_id),
      amount_paid_uyu = coalesce(p_amount, total_uyu)
  WHERE id = p_order_id;

  RETURN 'confirmed';
END;
$$;

REVOKE EXECUTE ON FUNCTION confirm_bar_order_payment FROM anon, authenticated, public;
