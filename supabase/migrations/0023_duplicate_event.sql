-- ============================================================
-- 0023_duplicate_event.sql — Copiar un evento a otra fecha
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Edición de eventos y tandas".
-- Cada fiesta se arma como la anterior: los owners copian el evento con título y fechas
-- nuevas y después ajustan a mano lugar, precios, transporte y carta.
-- Todo en una transacción: el evento (borrador, sin ventas, puerta y barra abiertas), sus
-- tandas (sin vendidas, sin agotar a mano y sin fechas de salida, que son de la fecha vieja),
-- el transporte y la carta de la barra. No se copia nada de la gente: entradas, compras,
-- check-ins, códigos de descuento y de acceso, pedidos de barra, comunicaciones ni encuestas.
-- p_slug llega con slugify() del título; si ya existe se le agrega -2, -3…

CREATE OR REPLACE FUNCTION duplicate_event(
  p_source_id  uuid,
  p_title      text,
  p_slug       text,
  p_date_start timestamptz,
  p_date_end   timestamptz
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id   uuid;
  v_slug text := p_slug;
  v_n    integer := 1;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_source_id) THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  WHILE EXISTS (SELECT 1 FROM events WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := p_slug || '-' || v_n;
  END LOOP;

  INSERT INTO events (
    slug, title, date_start, date_end, location_name, location_url, description_md,
    hero_image_url, gallery_urls, lineup, arrival_info, format, capacity,
    status, sales_active, door_closed, bar_paused
  )
  SELECT
    v_slug, p_title, p_date_start, p_date_end, location_name, location_url, description_md,
    hero_image_url, gallery_urls, lineup, arrival_info, format, capacity,
    'draft', false, false, false
  FROM events WHERE id = p_source_id
  RETURNING id INTO v_id;

  INSERT INTO ticket_tiers (
    event_id, name, description, price_uyu, quantity_total, sort_order, active, entry_until, presale_code
  )
  SELECT v_id, name, description, price_uyu, quantity_total, sort_order, active, entry_until, presale_code
  FROM ticket_tiers WHERE event_id = p_source_id;

  -- El transporte se lista por created_at y now() es el mismo en toda la transacción: se
  -- separan por un microsegundo para que queden en el mismo orden que en el original.
  INSERT INTO transport_options (event_id, name, departure, price_uyu, capacity, active, created_at)
  SELECT v_id, name, departure, price_uyu, capacity, active,
         now() + (row_number() OVER (ORDER BY created_at, id)) * interval '1 microsecond'
  FROM transport_options WHERE event_id = p_source_id;

  INSERT INTO bar_products (event_id, name, description, price_uyu, active, sort_order)
  SELECT v_id, name, description, price_uyu, active, sort_order
  FROM bar_products WHERE event_id = p_source_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION duplicate_event FROM anon, authenticated, public;
