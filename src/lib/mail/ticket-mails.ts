// Arma los datos de una entrada y manda el mail que corresponde.
// Se llama desde: confirmación de pago (Mercado Pago), alta manual/invitación en el admin,
// anulación/reembolso y "Reenviar mail" del admin.
import QRCode from 'qrcode';
import { formatLocal } from '@/lib/events';
import { priceBreakdown } from '@/lib/pricing';
import { createAdminClient } from '@/lib/supabase/admin';
import { ticketUrl } from '@/lib/tickets';
import { sendMail } from './send';
import { ticketCancelledEmail, ticketConfirmedEmail, type TicketMailData } from './templates';

async function loadTicket(ticketId: string) {
  const db = createAdminClient();
  const { data: t } = await db
    .from('tickets')
    .select('id, buyer_name, buyer_email, buyer_document, source, tier_id, event_id, qr_token, amount_paid_uyu')
    .eq('id', ticketId)
    .single();
  if (!t?.qr_token) return null;

  const [{ data: event }, { data: tier }] = await Promise.all([
    db.from('events').select('title, date_start').eq('id', t.event_id).single(),
    t.tier_id
      ? db.from('ticket_tiers').select('name, price_uyu').eq('id', t.tier_id).single()
      : Promise.resolve({ data: null }),
  ]);
  if (!event) return null;

  const total = Number(t.amount_paid_uyu);
  // En compras web el total incluye el cargo por servicio; se desglosa con el precio de la tanda.
  const breakdown =
    t.source === 'purchase' && tier ? priceBreakdown(Number(tier.price_uyu)) : null;

  const data: TicketMailData = {
    firstName: t.buyer_name.split(' ')[0],
    fullName: t.buyer_name,
    docTail: t.buyer_document.slice(-4),
    eventTitle: event.title,
    dateLong: formatLocal(event.date_start, "EEEE d 'de' MMMM · HH:mm 'hs'").replace(/^./, (c) => c.toUpperCase()),
    dateShort: formatLocal(event.date_start, 'dd.MM.yy'),
    entryLabel: t.source === 'invitation' ? 'Invitación' : (tier?.name ?? 'Entrada'),
    ticketUrl: ticketUrl(t.qr_token),
    price: breakdown && breakdown.total === total ? breakdown.price : null,
    fee: breakdown && breakdown.total === total ? breakdown.fee : null,
    total,
  };
  return { ticket: t, data };
}

export async function sendTicketConfirmedMail(ticketId: string): Promise<boolean> {
  const loaded = await loadTicket(ticketId);
  if (!loaded) return false;
  const { subject, html, text } = ticketConfirmedEmail(loaded.data);
  const qr = await QRCode.toBuffer(loaded.data.ticketUrl, { width: 400, margin: 1, errorCorrectionLevel: 'M' });
  return sendMail({
    to: loaded.ticket.buyer_email,
    subject,
    html,
    text,
    attachments: [{ filename: 'entrada-qr.png', content: qr, cid: 'qr' }],
    log: { ticketId, type: 'confirmation' },
  });
}

export async function sendTicketCancelledMail(ticketId: string, refunded: boolean): Promise<boolean> {
  const loaded = await loadTicket(ticketId);
  if (!loaded) return false;
  const { subject, html, text } = ticketCancelledEmail({ ...loaded.data, refunded });
  return sendMail({ to: loaded.ticket.buyer_email, subject, html, text, log: { ticketId, type: 'cancelled' } });
}
