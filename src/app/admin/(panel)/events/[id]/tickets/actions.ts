'use server';

// Acciones del admin sobre las entradas de un evento.
// Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Entradas manuales e invitaciones" y "Anular".
import { revalidatePath } from 'next/cache';
import { logAdminAction, requireAdmin, requireOwner } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { buyerSchema, createTicket, ticketUrl } from '@/lib/tickets';
import { sendTicketCancelledMail, sendTicketConfirmedMail, sendTransferRejectedMail } from '@/lib/mail/ticket-mails';
import { refundPayment } from '@/lib/mercadopago';

export type ManualTicketResult =
  | { ok: true; url: string; name: string; phone: string | null; mailed: boolean }
  | { error: string; field?: string };

export async function createManualTicketAction(
  eventId: string,
  formData: FormData,
): Promise<ManualTicketResult> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { error: 'Tu sesión venció. Volvé a entrar.' };

  const parsed = buyerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    document: formData.get('document'),
    phone: formData.get('phone'),
    instagram: formData.get('instagram'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }

  // tier = id de la tanda → venta manual (cobrada por transferencia, descuenta stock)
  // tier = "invitation"   → invitación: sin tanda, monto 0, no descuenta stock
  const tierValue = String(formData.get('tier') ?? '');
  const isInvitation = tierValue === 'invitation';
  const amount = isInvitation ? 0 : Number(formData.get('amount') ?? 0);
  if (!isInvitation && (!tierValue || Number.isNaN(amount) || amount < 0)) {
    return { error: 'Elegí una tanda y un monto válido.', field: 'tier' };
  }

  const result = await createTicket({
    eventId,
    tierId: isInvitation ? null : tierValue,
    source: isInvitation ? 'invitation' : 'manual',
    status: 'paid',
    buyer: parsed.data,
    amount,
    adminId: admin.id,
    notes: String(formData.get('notes') ?? '') || null,
  });
  if ('error' in result) return { error: result.error };

  await logAdminAction(admin.id, isInvitation ? 'create_invitation' : 'create_manual_ticket', 'ticket', result.id);
  // Mail con la entrada (se puede destildar en el form, p. ej. si se la mandan por WhatsApp).
  const mailed = formData.get('send_mail') === 'on' ? await sendTicketConfirmedMail(result.id) : false;
  revalidatePath(`/admin/events/${eventId}/tickets`);
  return {
    ok: true,
    url: ticketUrl(result.qrToken),
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    mailed,
  };
}

// Anular: si la entrada se pagó por Mercado Pago, primero se devuelve la plata y recién
// después se anula (queda 'refunded'). Si falla la devolución, no se anula nada.
// Las manuales e invitaciones se anulan directo ('cancelled'); la devolución de una
// transferencia se hace por fuera.
// Una transferencia a validar no se anula acá: la aprueba o la rechaza un owner.
export async function cancelTicketAction(eventId: string, ticketId: string): Promise<void> {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const { data: ticket } = await db
    .from('tickets')
    .select('id, status, source, mp_payment_id')
    .eq('id', ticketId)
    .single();
  if (!ticket) return;
  if (ticket.status === 'review') {
    throw new Error('Las transferencias a validar se aprueban o se rechazan (solo owners).');
  }

  let refunded = false;
  if (ticket.source === 'purchase' && ticket.status === 'paid' && ticket.mp_payment_id) {
    const ok = await refundPayment(ticket.mp_payment_id);
    if (!ok) throw new Error('Mercado Pago no aceptó la devolución. La entrada sigue válida.');
    refunded = true;
  }

  await db.rpc('cancel_ticket', { p_ticket_id: ticketId, p_refunded: refunded });
  await logAdminAction(admin.id, refunded ? 'refund_ticket' : 'cancel_ticket', 'ticket', ticketId);
  // Solo se avisa si la entrada estaba válida: una compra pendiente nunca tuvo entrada.
  if (ticket.status === 'paid') await sendTicketCancelledMail(ticketId, refunded);
  revalidatePath(`/admin/events/${eventId}/tickets`);
}

export async function resendTicketMailAction(eventId: string, ticketId: string): Promise<void> {
  const admin = await requireAdmin();
  await sendTicketConfirmedMail(ticketId);
  await logAdminAction(admin.id, 'resend_ticket_mail', 'ticket', ticketId);
  revalidatePath(`/admin/events/${eventId}/tickets`);
}

// Transferencias: un owner revisa que la plata haya llegado y aprueba o rechaza.
// Aprobar → la entrada pasa a válida y le llega el mail con el QR.
// Rechazar → se anula, el lugar se libera y le llega un mail para que escriba por Instagram.
export async function approveTransferAction(eventId: string, ticketId: string): Promise<void> {
  const admin = await requireOwner();
  const db = createAdminClient();
  const { data } = await db.rpc('approve_transfer', { p_ticket_id: ticketId, p_admin_id: admin.id });
  if (data === 'approved') {
    await logAdminAction(admin.id, 'approve_transfer', 'ticket', ticketId);
    await sendTicketConfirmedMail(ticketId);
  }
  revalidatePath(`/admin/events/${eventId}/tickets`);
}

export async function rejectTransferAction(eventId: string, ticketId: string): Promise<void> {
  const admin = await requireOwner();
  const db = createAdminClient();
  const { data } = await db.rpc('reject_transfer', { p_ticket_id: ticketId, p_admin_id: admin.id });
  if (data === 'rejected') {
    await logAdminAction(admin.id, 'reject_transfer', 'ticket', ticketId);
    await sendTransferRejectedMail(ticketId);
  }
  revalidatePath(`/admin/events/${eventId}/tickets`);
}
