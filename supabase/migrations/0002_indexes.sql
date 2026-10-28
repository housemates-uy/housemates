-- ============================================================
-- 0002_indexes.sql — Índices de performance
-- ============================================================

-- events
CREATE INDEX idx_events_status         ON events(status);
CREATE INDEX idx_events_sales_active   ON events(sales_active) WHERE sales_active = true;
CREATE INDEX idx_events_date_start     ON events(date_start);

-- ticket_tiers
CREATE INDEX idx_tiers_event_id        ON ticket_tiers(event_id);
CREATE INDEX idx_tiers_active          ON ticket_tiers(event_id, active) WHERE active = true;

-- tickets
CREATE INDEX idx_tickets_event_id      ON tickets(event_id);
CREATE INDEX idx_tickets_buyer_email   ON tickets(buyer_email);
CREATE INDEX idx_tickets_status        ON tickets(status);
CREATE INDEX idx_tickets_qr_token      ON tickets(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX idx_tickets_mp_payment_id ON tickets(mp_payment_id) WHERE mp_payment_id IS NOT NULL;

-- whitelist
CREATE INDEX idx_whitelist_email       ON whitelist(email);
CREATE INDEX idx_whitelist_status      ON whitelist(status);
CREATE INDEX idx_whitelist_tags        ON whitelist USING GIN(tags);

-- check_ins
CREATE INDEX idx_checkins_ticket_id    ON check_ins(ticket_id);
CREATE INDEX idx_checkins_scanned_at   ON check_ins(scanned_at);

-- admin_logs
CREATE INDEX idx_logs_admin_id         ON admin_logs(admin_id);
CREATE INDEX idx_logs_entity           ON admin_logs(entity_type, entity_id);
CREATE INDEX idx_logs_created_at       ON admin_logs(created_at);

-- gate_attempts
CREATE INDEX idx_gate_ip_time          ON gate_attempts(ip, attempted_at);

-- email_log
CREATE INDEX idx_email_log_ticket_id   ON email_log(ticket_id);
