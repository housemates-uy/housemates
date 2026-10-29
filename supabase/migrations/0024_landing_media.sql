-- ============================================================
-- 0024_landing_media.sql — Fotos y videos de la landing
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Landing".
-- Los owners cambian las fotos y los videos de la portada y de La casa desde /admin/landing.
-- Los archivos van a este bucket público (la landing los muestra sin login). El navegador
-- los sube directo con un link firmado que arma el servidor solo para owners: Vercel no
-- acepta pedidos de más de 4,5 MB y un video pesa más. Sin políticas en storage.objects:
-- nadie sube ni borra con la anon key, solo con el link firmado o la service key.
-- Qué foto va en cada lugar se guarda en site_config (clave landing_media).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'landing', 'landing', true, 52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;
