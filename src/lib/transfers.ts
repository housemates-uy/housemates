// ============================================================
// Validar transferencias con comprobante. Ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
// ============================================================
// Solo owners. Lo usan Entradas a confirmar (/admin/confirmar) y la pestaña Entradas del
// evento. Una transferencia paga una compra entera (la entrada de quien compró y las de sus
// amigos, §5.2e): se acepta o se declina todo el grupo, con el id de cualquiera de sus
// entradas. approve_transfer / reject_transfer bloquean cada entrada y actúan solo si sigue en
// `review`: si dos owners (o un doble toque) la resuelven a la vez, el segundo recibe
// `not_in_review` y no se registra ni se manda nada de nuevo.
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { sendTicketConfirmedMail, sendTransferRejectedMail } from '@/lib/mail/ticket-mails';
import { createAdminClient } from '@/lib/supabase/admin';

export type TransferOutcome = { result: string; mailed: boolean; count: number };

// La entrada de quien compró y las entradas del grupo que siguen en revisión (quien compró
// primero). Una entrada sin grupo (las de antes) es un grupo de una.
async function reviewGroup(ticketId: string): Promise<{ leadId: string; ids: string[] }> {
  const db = createAdminClient();
  const { data: ticket } = await db.from('tickets').select('id, order_id').eq('id', ticketId).maybeSingle();
  const leadId = ticket?.order_id ?? ticket?.id ?? ticketId;
  const { data } = await db
    .from('tickets')
    .select('id')
    .or(`id.eq.${leadId},order_id.eq.${leadId}`)
    .eq('status', 'review');
  const ids = (data ?? []).map((t) => t.id).sort((a, b) => (a === leadId ? -1 : b === leadId ? 1 : 0));
  return { leadId, ids: ids.length ? ids : [ticketId] };
}

// Aceptar → cada entrada pasa a `paid`, suma a la tanda y a cada persona le llega su
// entrada con el QR a su mail.
export async function approveTransfer(ticketId: string): Promise<TransferOutcome> {
  const admin = await requireOwner();
  const db = createAdminClient();
  const { leadId, ids } = await reviewGroup(ticketId);
  const results = await Promise.all(
    ids.map(async (id) => ({ id, result: (await db.rpc('approve_transfer', { p_ticket_id: id, p_admin_id: admin.id })).data })),
  );
  const approved = results.filter((r) => r.result === 'approved').map((r) => r.id);
  if (approved.length === 0) return { result: results[0]?.result ?? 'error', mailed: false, count: 0 };
  await logAdminAction(admin.id, 'approve_transfer', 'ticket', leadId, { entradas: approved.length });
  const mails = await Promise.all(approved.map((id) => sendTicketConfirmedMail(id)));
  return { result: 'approved', mailed: mails.every(Boolean), count: approved.length };
}

// Declinar → todas las entradas de la compra pasan a `cancelled` y se liberan sus lugares.
// El aviso le llega solo a quien compró (pagó él; los amigos no sabían de la compra).
export async function rejectTransfer(ticketId: string): Promise<TransferOutcome> {
  const admin = await requireOwner();
  const db = createAdminClient();
  const { leadId, ids } = await reviewGroup(ticketId);
  const results = await Promise.all(
    ids.map(async (id) => ({ id, result: (await db.rpc('reject_transfer', { p_ticket_id: id, p_admin_id: admin.id })).data })),
  );
  const rejected = results.filter((r) => r.result === 'rejected').map((r) => r.id);
  if (rejected.length === 0) return { result: results[0]?.result ?? 'error', mailed: false, count: 0 };
  await logAdminAction(admin.id, 'reject_transfer', 'ticket', leadId, { entradas: rejected.length });
  const notify = rejected.includes(leadId) ? leadId : rejected[0];
  return { result: 'rejected', mailed: await sendTransferRejectedMail(notify), count: rejected.length };
}
