'use server';

// Acciones del admin sobre las entradas de un evento.
// Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Entradas manuales e invitaciones" y "Anular".
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAdminAction, requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { buyerSchema, createTicket, ticketUrl } from '@/lib/tickets';
import { sendTicketCancelledMail, sendTicketConfirmedMail } from '@/lib/mail/ticket-mails';
import { isMercadoPagoConfigured, refundPayment, syncPayment } from '@/lib/mercadopago';
import { approveTransfer, rejectTransfer } from '@/lib/transfers';

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

  const notes = String(formData.get('notes') ?? '').trim();
  if (notes.length > 500) return { error: 'Las notas pueden tener hasta 500 caracteres.', field: 'notes' };

  const result = await createTicket({
    eventId,
    tierId: isInvitation ? null : tierValue,
    source: isInvitation ? 'invitation' : 'manual',
    status: 'paid',
    buyer: parsed.data,
    amount,
    adminId: admin.id,
    notes: notes || null,
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
// después se anula (queda 'refunded'). Si falla la devolución, no se anula nada. Antes de
// devolver se le pregunta el pago a Mercado Pago (syncPayment): si ya figura devuelto (p. ej.
// lo devolvieron desde el panel de MP), syncPayment la anula como reembolsada y avisa, y acá
// no se intenta devolver de nuevo.
// Las manuales, invitaciones y transferencias se anulan directo ('cancelled'); la devolución
// de una transferencia se hace por fuera.
// No se anulan: una transferencia a validar (la aprueba o la rechaza un owner) ni una compra
// con pago en curso (la reserva vence sola; si la anulamos y paga igual, revive).
// Si no cambió nada, el error vuelve al botón (useFormState). Si cambió algo, el resultado
// viaja en la URL (?hecho=…&entrada=…, textos en CANCEL_OUTCOMES de la página): al
// revalidar, el loading.tsx raíz vuelve a montar la lista y un estado local se perdería.
// Solo con 'cancelled' se registra la anulación y sale el mail.
export type CancelTicketState = { error: string } | null;
export type CancelTicketView = { q: string; pagina: number };

const MP_REVERSED = new Set(['refunded', 'charged_back']);

function backToList(eventId: string, ticketId: string, view: CancelTicketView, hecho: string): never {
  const params = new URLSearchParams();
  if (view.q) params.set('q', view.q);
  if (view.pagina > 1) params.set('pagina', String(view.pagina));
  params.set('hecho', hecho);
  params.set('entrada', ticketId);
  revalidatePath(`/admin/events/${eventId}`, 'layout');
  redirect(`/admin/events/${eventId}/tickets?${params}#lista`);
}

export async function cancelTicketAction(
  eventId: string,
  ticketId: string,
  view: CancelTicketView,
  _prev: CancelTicketState,
): Promise<CancelTicketState> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { error: 'Tu sesión venció. Volvé a entrar.' };
  const db = createAdminClient();

  const { data: ticket, error: readError } = await db
    .from('tickets')
    .select('id, status, source, mp_payment_id')
    .eq('id', ticketId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError) return { error: 'No pudimos leer la entrada. Probá de nuevo.' };
  if (!ticket) return { error: 'No se encontró la entrada.' };
  if (ticket.status === 'review') {
    return { error: 'Las transferencias a validar no se anulan: las aprueba o las rechaza un owner.' };
  }
  if (ticket.status === 'pending') {
    return { error: 'Es un pago en curso: si no se completa, la reserva vence sola y el lugar se libera.' };
  }
  if (ticket.status === 'used') return { error: 'La entrada ya se usó en puerta: no se puede anular.' };
  if (ticket.status !== 'paid') return { error: 'La entrada ya estaba anulada.' };

  let refunded = false;
  if (ticket.source === 'purchase' && ticket.mp_payment_id) {
    if (!isMercadoPagoConfigured()) {
      return { error: 'Mercado Pago no está conectado: no se puede devolver la plata. La entrada sigue válida.' };
    }
    const sync = await syncPayment(ticket.mp_payment_id).catch(() => null);
    if (!sync) {
      return { error: 'No pudimos consultar el pago en Mercado Pago. La entrada sigue válida: probá de nuevo.' };
    }
    if (MP_REVERSED.has(sync.status)) {
      await logAdminAction(admin.id, 'refund_ticket', 'ticket', ticketId, {
        already_refunded_in_mp: true,
        result: sync.result ?? null,
      });
      backToList(eventId, ticketId, view, sync.result === 'cancelled' ? 'ya-devuelta' : sync.result === 'already_used' ? 'devuelta-usada' : 'devuelta-revisar');
    }
    if (!(await refundPayment(ticket.mp_payment_id))) {
      return { error: 'Mercado Pago no aceptó la devolución. La entrada sigue válida.' };
    }
    refunded = true;
  }

  const { data: result, error } = await db.rpc('cancel_ticket', { p_ticket_id: ticketId, p_refunded: refunded });
  if (error || result !== 'cancelled') {
    if (!refunded) {
      if (result === 'already_used') return { error: 'La entrada ya se usó en puerta: no se puede anular.' };
      if (result === 'already_cancelled') return { error: 'La entrada ya estaba anulada.' };
      if (result === 'not_found') return { error: 'No se encontró la entrada.' };
      return { error: 'No se pudo anular la entrada. Probá de nuevo.' };
    }
    // La plata ya se devolvió: queda registrado aunque la entrada no se haya podido anular.
    await logAdminAction(admin.id, 'refund_ticket', 'ticket', ticketId, { result: result ?? 'error' });
    // already_cancelled: el aviso de Mercado Pago (webhook) llegó primero, la anuló y mandó el mail.
    backToList(eventId, ticketId, view, result === 'already_used' ? 'devuelta-usada' : result === 'already_cancelled' ? 'reembolsada' : 'devuelta-sin-anular');
  }

  await logAdminAction(admin.id, refunded ? 'refund_ticket' : 'cancel_ticket', 'ticket', ticketId);
  const mailed = await sendTicketCancelledMail(ticketId, refunded);
  const done = refunded ? 'reembolsada' : 'anulada';
  backToList(eventId, ticketId, view, mailed ? done : `${done}-sin-mail`);
}

export async function resendTicketMailAction(eventId: string, ticketId: string): Promise<void> {
  const admin = await requireAdmin();
  await sendTicketConfirmedMail(ticketId);
  await logAdminAction(admin.id, 'resend_ticket_mail', 'ticket', ticketId);
  revalidatePath(`/admin/events/${eventId}/tickets`);
}

// Transferencias: un owner revisa que la plata haya llegado y aprueba o rechaza, con la misma
// lógica que Entradas a confirmar (src/lib/transfers.ts). Se revalida todo el admin para que
// baje el contador de pendientes del menú.
export async function approveTransferAction(ticketId: string): Promise<void> {
  await approveTransfer(ticketId);
  revalidatePath('/admin', 'layout');
}

export async function rejectTransferAction(ticketId: string): Promise<void> {
  await rejectTransfer(ticketId);
  revalidatePath('/admin', 'layout');
}
