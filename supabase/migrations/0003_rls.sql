-- ============================================================
-- 0003_rls.sql — Row Level Security
-- Filosofía: falla cerrado. El cliente (anon key) solo ve lo mínimo.
-- Las API routes de admin usan service_role que bypasea RLS.
-- ============================================================

ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EVENTS — lectura pública solo de eventos publicados
-- ============================================================
CREATE POLICY "eventos_lectura_publica"
  ON events FOR SELECT
  USING (status = 'published');

-- ============================================================
-- TICKET_TIERS — lectura pública solo de tiers activos de eventos publicados
-- ============================================================
CREATE POLICY "tiers_lectura_publica"
  ON ticket_tiers FOR SELECT
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_tiers.event_id
        AND e.status = 'published'
        AND e.sales_active = true
    )
  );

-- ============================================================
-- TICKETS — lectura solo del dueño por email
-- Escritura solo desde server (service_role)
-- ============================================================
CREATE POLICY "tickets_lectura_dueno"
  ON tickets FOR SELECT
  USING (buyer_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- ============================================================
-- WHITELIST, ADMINS, ADMIN_LOGS, SITE_CONFIG, GATE_ATTEMPTS, EMAIL_LOG
-- Sin acceso público — solo service_role
-- ============================================================
-- (Sin policies = acceso denegado para anon. service_role bypasea RLS.)
