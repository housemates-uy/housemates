-- ============================================================
-- 0009_ticket_review_status.sql — Estado "en revisión" para pagos por transferencia
-- ============================================================
-- La persona transfirió y subió el comprobante: la entrada queda reservada hasta que un
-- owner lo valida (pasa a 'paid') o lo rechaza (pasa a 'cancelled').
-- Va en una migración aparte: Postgres no deja usar un valor de enum nuevo dentro de la
-- misma transacción en la que se agrega, y 0010 ya lo usa en índices y funciones.
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'review';
