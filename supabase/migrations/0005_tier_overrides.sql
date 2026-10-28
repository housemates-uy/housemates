-- ============================================================
-- 0005_tier_overrides.sql — Cambios que se aplicaron a mano en dev (ver #016)
-- ============================================================
-- Idempotente: en la base de dev ya existen, en una base nueva se crean.

ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS sold_out_override boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_tiers_event_name_unique
  ON ticket_tiers (event_id, lower(name));
