-- ============================================================
-- 0025_admin_delete.sql — Eliminar desde el panel sin perder datos
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Eliminar".
-- Solo se elimina lo que nunca se usó; lo demás se archiva, se desactiva o se pausa.
-- Las tandas, los códigos de acceso y las opciones de transporte ya los cuida la base (las
-- entradas las referencian con FK RESTRICT / NO ACTION). Estas funciones son para lo que la
-- base no frena sola:
-- - Un evento: se borra con todo lo suyo por ON DELETE CASCADE (tandas, transporte, carta,
--   códigos de descuento y de acceso) solo si no tiene entradas de ningún estado, pedidos de
--   barra ni escaneos en la puerta o la barra (check_ins y bar_scans también son CASCADE).
-- - Un trago o un código de descuento: sus FK son SET NULL, así que borrarlos con uso dejaría
--   pedidos o entradas sin saber qué eran.
-- El FOR UPDATE sobre la fila hace esperar a quien esté insertando algo que la referencia (la
-- FK toma FOR KEY SHARE); cada chequeo de abajo ve lo que se confirmó mientras tanto, y lo que
-- se intente insertar después falla porque la fila ya no está.

CREATE INDEX IF NOT EXISTS idx_tickets_tier ON tickets (tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bar_units_product ON bar_order_units (product_id) WHERE product_id IS NOT NULL;

-- Por qué no se puede eliminar un evento: 'has_tickets', 'has_bar_orders', 'has_scans' o null.
CREATE OR REPLACE FUNCTION event_delete_blocker(p_event_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM tickets WHERE event_id = p_event_id) THEN 'has_tickets'
    WHEN EXISTS (SELECT 1 FROM bar_orders WHERE event_id = p_event_id) THEN 'has_bar_orders'
    WHEN EXISTS (SELECT 1 FROM check_ins WHERE event_id = p_event_id)
      OR EXISTS (SELECT 1 FROM bar_scans WHERE event_id = p_event_id) THEN 'has_scans'
  END;
$$;

-- Devuelve { result: 'deleted', deleted: {...lo que se borró} }, { result: <bloqueo> } o
-- { result: 'not_found' }.
CREATE OR REPLACE FUNCTION admin_delete_event(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_blocker text;
  v_deleted jsonb;
BEGIN
  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;

  v_blocker := event_delete_blocker(p_event_id);
  IF v_blocker IS NOT NULL THEN
    RETURN jsonb_build_object('result', v_blocker);
  END IF;

  SELECT jsonb_build_object(
    'title', e.title,
    'date_start', e.date_start,
    'tiers', (SELECT coalesce(jsonb_agg(name ORDER BY sort_order, name), '[]'::jsonb)
              FROM ticket_tiers WHERE event_id = p_event_id),
    'transport_options', (SELECT coalesce(jsonb_agg(name ORDER BY created_at, id), '[]'::jsonb)
                          FROM transport_options WHERE event_id = p_event_id),
    'bar_products', (SELECT coalesce(jsonb_agg(name ORDER BY sort_order, name), '[]'::jsonb)
                     FROM bar_products WHERE event_id = p_event_id),
    'discount_codes', (SELECT coalesce(jsonb_agg(code ORDER BY created_at, id), '[]'::jsonb)
                       FROM discount_codes WHERE event_id = p_event_id),
    'access_codes', (SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label)
                                               ORDER BY created_at, id), '[]'::jsonb)
                     FROM access_codes WHERE event_id = p_event_id)
  ) INTO v_deleted
  FROM events e WHERE e.id = p_event_id;

  DELETE FROM events WHERE id = p_event_id;
  RETURN jsonb_build_object('result', 'deleted', 'deleted', v_deleted);
END;
$$;

-- 'deleted', 'in_use' (está en algún pedido, de cualquier estado) o 'not_found'.
CREATE OR REPLACE FUNCTION admin_delete_bar_product(p_product_id uuid, p_event_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM bar_products WHERE id = p_product_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM bar_order_units WHERE product_id = p_product_id) THEN
    RETURN 'in_use';
  END IF;
  DELETE FROM bar_products WHERE id = p_product_id;
  RETURN 'deleted';
END;
$$;

-- 'deleted', 'in_use' (alguna entrada, de cualquier estado, lo usó) o 'not_found'.
CREATE OR REPLACE FUNCTION admin_delete_discount_code(p_code_id uuid, p_event_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM discount_codes WHERE id = p_code_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM tickets WHERE discount_code_id = p_code_id) THEN
    RETURN 'in_use';
  END IF;
  DELETE FROM discount_codes WHERE id = p_code_id;
  RETURN 'deleted';
END;
$$;

REVOKE EXECUTE ON FUNCTION event_delete_blocker FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION admin_delete_event FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION admin_delete_bar_product FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION admin_delete_discount_code FROM anon, authenticated, public;
