-- ============================================================
-- 0031_bar_access.sql — Barra solo con el link o el QR, y usuario de barra
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Barra" y "Acceso de admins".
--
-- 1. Cada evento tiene una clave al azar (events.bar_key). /barra/k/<clave> deja una cookie
--    para ese evento y sin esa cookie /barra no muestra la carta ni deja comprar. "Cambiar
--    link" (Admin → evento → Barra) pone otra clave y la vieja deja de valer. events no tiene
--    lectura pública (0016): la clave no sale con la anon key.
-- 2. Rol `barra` en admins: solo el escáner de barra y /scan (lo controla la app,
--    src/lib/auth/admin.ts). Un valor nuevo de enum no se puede usar en la misma transacción
--    en que se agrega: por eso esta migración no lo usa.

ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'barra';

-- 16 hex (64 bits): no se adivina, y el QR impreso queda liviano.
CREATE OR REPLACE FUNCTION new_bar_key() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT encode(extensions.gen_random_bytes(8), 'hex')
$$;

REVOKE EXECUTE ON FUNCTION new_bar_key FROM anon, authenticated, public;

-- Con un default volátil cada evento existente recibe su propia clave.
ALTER TABLE events ADD COLUMN IF NOT EXISTS bar_key text NOT NULL DEFAULT new_bar_key()
  CHECK (bar_key ~ '^[0-9a-f]{16}$');

CREATE UNIQUE INDEX IF NOT EXISTS events_bar_key_key ON events (bar_key);

-- Igual que en 0028, y la copia recibe una clave de barra nueva: el link o el QR de la
-- fiesta anterior no abren la barra de la nueva.
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
    status, sales_active, door_closed, bar_paused, bar_key
  )
  SELECT
    v_slug, p_title, p_date_start, p_date_end, location_name, location_url, description_md,
    hero_image_url, gallery_urls, lineup, arrival_info, format, capacity,
    'draft', false, false, false, new_bar_key()
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
