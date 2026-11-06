-- ============================================================
-- 0013_event_comms.sql — Comunicación con quienes tienen entrada
-- ============================================================
-- Explicación completa en docs/LOGICA_DE_NEGOCIO.md → "Comunicación".
--   - Mail "Antes de ir" (recordatorio) a las entradas válidas: usa email_type 'reminder'
--     (existe desde 0001).
--   - Encuesta del día después a quienes entraron: email_type 'survey' nuevo.
-- Cada envío queda en email_log; de ahí se sabe quién ya lo recibió (no se reenvía).

-- ------------------------------------------------------------
-- 1. "Cómo llegar": texto libre opcional del evento, va en el recordatorio
-- ------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS arrival_info text CHECK (char_length(arrival_info) <= 2000);

-- ------------------------------------------------------------
-- 2. Tipo de mail nuevo
-- ------------------------------------------------------------
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'survey';

-- ------------------------------------------------------------
-- 3. Respuestas de la encuesta: una por entrada (si vuelve a entrar, la edita)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  improve       text CHECK (char_length(improve) <= 1000),
  would_return  boolean NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON event_feedback(event_id);
-- "¿Quién ya recibió el recordatorio / la encuesta?" filtra email_log por tipo.
CREATE INDEX IF NOT EXISTS idx_email_log_type_ticket ON email_log(type, ticket_id);

-- Sin policies: solo el servidor (service_role) lee y escribe.
ALTER TABLE event_feedback ENABLE ROW LEVEL SECURITY;
