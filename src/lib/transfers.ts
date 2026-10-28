// ============================================================
// Validar transferencias con comprobante. Ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
// ============================================================
// Solo owners. Lo usan Entradas a confirmar (/admin/confirmar) y la pestaña Entradas del
// evento. approve_transfer / reject_transfer bloquean la entrada y actúan solo si sigue en
// `review`: si dos owners (o un doble toque) la resuelven a la vez, el segundo recibe
// `not_in_review` y no se registra ni se manda nada de nuevo.
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { sendTicketConfirmedMail, sendTransferRejectedMail } from '@/lib/mail/ticket-mails';
import { createAdminClient } from '@/lib/supabase/admin';

export type TransferOutcome = { result: string; mailed: boolean };

// Aceptar → la entrada pasa a `paid`, suma a la tanda y le llega el mail con el QR.
export async function approveTransfer(ticketId: string): Promise<TransferOutcome> {
  const admin = await requireOwner();
  const { data } = await createAdminClient().rpc('approve_transfer', {
    p_ticket_id: ticketId,
    p_admin_id: admin.id,
  });
  if (data !== 'approved') return { result: data ?? 'error', mailed: false };
  await logAdminAction(admin.id, 'approve_transfer', 'ticket', ticketId);
  return { result: data, mailed: await sendTicketConfirmedMail(ticketId) };
}

// Declinar → la entrada pasa a `cancelled`, el lugar se libera y le llega un mail para que
// escriba por Instagram.
export async function rejectTransfer(ticketId: string): Promise<TransferOutcome> {
  const admin = await requireOwner();
  const { data } = await createAdminClient().rpc('reject_transfer', {
    p_ticket_id: ticketId,
    p_admin_id: admin.id,
  });
  if (data !== 'rejected') return { result: data ?? 'error', mailed: false };
  await logAdminAction(admin.id, 'reject_transfer', 'ticket', ticketId);
  return { result: data, mailed: await sendTransferRejectedMail(ticketId) };
}
