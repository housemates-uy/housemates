-- ============================================================
-- 0019_comms_dedupe.sql — Recordatorio, encuesta y preventa no salen dos veces
-- ============================================================
-- Explicación en docs/LOGICA_DE_NEGOCIO.md → "Comunicación" y "Tandas" (preventa).
-- Antes, si dos envíos corrían a la vez (dos owners, un doble clic o el cron mientras un
-- owner mandaba a mano), los dos calculaban los mismos pendientes y les mandaban a todos.
-- Ahora cada destinatario se reserva antes de mandar: se inserta su fila en 'sending' con
-- ON CONFLICT DO NOTHING y el mail sale solo si el insert entró. Al terminar pasa a 'sent' o
-- 'failed'. Una reserva que quedó en 'sending' más de 10 minutos (la función se cortó a la
-- mitad) se puede volver a tomar.

ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'sending';

-- Recordatorio y encuesta (email_log): una reserva por tipo, entrada y vuelta.
-- send_key = '<tipo>:<entrada>' para "Mandar" y el cron, y '<tipo>:<entrada>:<desde>' para
-- "Reenviar a todos" (desde = cuándo empezó el reenvío). Si el envío falla, la fila queda
-- 'failed' y sin send_key, así se puede volver a intentar. Los demás mails no la usan (NULL).
-- La preventa no necesita nada nuevo: presale_sends ya es única por tanda y email.
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS send_key text;
CREATE UNIQUE INDEX IF NOT EXISTS email_log_send_key ON email_log (send_key);
