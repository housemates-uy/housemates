-- ============================================================
-- 0028_bar_product_images.sql — Foto de cada trago de la barra
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Barra".
-- Los owners le ponen una foto a cada trago desde Admin → evento → Barra; /barra la muestra
-- al lado del nombre. El navegador la achica antes de mandarla y el servidor la sube con la
-- service key a este bucket público. Sin políticas en storage.objects: nadie sube ni borra
-- con la anon key.
-- image_path es la ruta dentro del bucket (<evento>/<8 hex>.<ext>). Al duplicar un evento la
-- carta copia la misma ruta: un archivo se borra solo cuando ya no lo usa ningún trago.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bar', 'bar', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE bar_products ADD COLUMN IF NOT EXISTS image_path text
  CHECK (image_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}\.(jpg|png|webp)$');

-- Igual que en 0023, ahora con la foto de cada trago.
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
  SELECT v_id, name, description, price_uyu, quantity_total, sort_order, active, entry_until,
         CASE WHEN presale_code IS NULL THEN NULL
              ELSE 'PRE-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)) END
  FROM ticket_tiers WHERE event_id = p_source_id;

  INSERT INTO transport_options (event_id, name, departure, price_uyu, capacity, active, created_at)
  SELECT v_id, name, departure, price_uyu, capacity, active,
         now() + (row_number() OVER (ORDER BY created_at, id)) * interval '1 microsecond'
  FROM transport_options WHERE event_id = p_source_id;

  INSERT INTO bar_products (event_id, name, description, price_uyu, active, sort_order, image_path)
  SELECT v_id, name, description, price_uyu, active, sort_order, image_path
  FROM bar_products WHERE event_id = p_source_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION duplicate_event FROM anon, authenticated, public;
