-- ============================================================
-- 0008_email_types.sql — Tipos de mail nuevos para email_log
-- ============================================================
-- confirmation: entrada confirmada (compra web, manual o invitación) — ya existía
-- cancelled:    entrada anulada (con o sin reembolso)
-- transfer_*:   flujo de pago por transferencia (pendiente de implementar)
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'transfer_received';
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'transfer_rejected';
ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'transfer_admin_alert';
