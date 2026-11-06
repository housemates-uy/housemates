-- ============================================================
-- 0030_refund_receipts.sql — Comprobante de devolución al anular una transferencia
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Anular y reembolsar".
-- Una entrada válida que se cobró por transferencia (compra web por transferencia o entrada
-- manual) y costó más de $0 no se anula sin el comprobante de que se devolvió la plata.
-- El servidor sube el archivo al bucket privado `comprobantes` con la service key
-- (devoluciones/<entrada>/<8 hex>.<ext>) y recién después llama a cancel_ticket con la ruta:
-- la anulación y la ruta quedan en el mismo UPDATE. Sin la ruta, cancel_ticket devuelve
-- 'refund_receipt_required' y no cambia nada, aunque alguien llame la acción sin la pantalla.
-- Siguen igual: Mercado Pago (se devuelve por MP), las transferencias en revisión (se aceptan
-- o se declinan) y las cortesías o entradas de $0 (no hay nada que devolver).

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_receipt_path text
  CHECK (refund_receipt_path ~ '^devoluciones/[0-9a-f-]{36}/[0-9a-f]{8}\.(jpg|png|webp|pdf)$');

-- Suma un parámetro: se borra la versión de 0006 para que no queden dos funciones con el mismo
-- nombre (las llamadas con dos argumentos de reverse_*_payment serían ambiguas).
DROP FUNCTION IF EXISTS cancel_ticket(uuid, boolean);

CREATE FUNCTION cancel_ticket(
  p_ticket_id           uuid,
  p_refunded            boolean DEFAULT false,
  p_refund_receipt_path text    DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ticket.status = 'used' THEN RETURN 'already_used'; END IF;
  IF v_ticket.status IN ('cancelled', 'refunded') THEN RETURN 'already_cancelled'; END IF;

  IF v_ticket.status = 'paid'
     AND v_ticket.amount_paid_uyu > 0
     AND (v_ticket.source = 'manual' OR v_ticket.payment_method = 'transfer')
     AND p_refund_receipt_path IS NULL THEN
    RETURN 'refund_receipt_required';
  END IF;

  UPDATE tickets
  SET status = CASE WHEN p_refunded THEN 'refunded'::ticket_status ELSE 'cancelled'::ticket_status END,
      cancelled_at = now(), reserved_until = NULL,
      refund_receipt_path = p_refund_receipt_path
  WHERE id = p_ticket_id;

  IF v_ticket.status = 'paid' AND v_ticket.tier_id IS NOT NULL THEN
    UPDATE ticket_tiers SET quantity_sold = greatest(quantity_sold - 1, 0) WHERE id = v_ticket.tier_id;
  END IF;

  RETURN 'cancelled';
END;
$$;

-- Una función nueva vuelve a tener los permisos por defecto: solo la llama el servidor.
REVOKE EXECUTE ON FUNCTION cancel_ticket FROM anon, authenticated, public;
