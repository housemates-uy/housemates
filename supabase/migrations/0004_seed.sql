-- ============================================================
-- 0004_seed.sql — Datos iniciales
-- ============================================================

-- Claves de configuración del site.
-- El primer admin se crea desde el dashboard de Supabase (Authentication → Users → Add user),
-- luego se inserta en la tabla admins con ese UUID.
INSERT INTO site_config (key, value) VALUES
  ('gate_password',  ''),
  ('hero_title',     'HOUSE MATES'),
  ('hero_subtitle',  ''),
  ('ig_handle',      '@house__mates')
ON CONFLICT (key) DO NOTHING;
