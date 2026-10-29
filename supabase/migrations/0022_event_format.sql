-- ============================================================
-- 0022_event_format.sql — Formato de cada evento ("Open air", "Indoor")
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Landing".
-- Antes "Open air" estaba fijo en la landing, /entradas y la entrada. Ahora se carga en el
-- alta y la edición del evento. Los eventos que ya existen quedan como estaban: Open air.

ALTER TABLE events ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'Open air';
