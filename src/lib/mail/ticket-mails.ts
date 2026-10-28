// Arma los datos de una entrada y manda el mail que corresponde.
// Se llama desde: confirmación de pago (Mercado Pago), alta manual/invitación en el admin,
// transferencias (comprobante recibido, aviso a los owners, aprobada o rechazada),
// anulación/reembolso y "Reenviar mail" del admin.
import QRCode from 'qrcode';
import { entryTime, formatLocal } from '@/lib/events';
import { mapsUrl } from '@/lib/next-event';
import { quote, type PayMethod } from '@/lib/pricing';
import { getIgHandle } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl, ticketUrl } from '@/lib/tickets';
import { getTicketTransport } from '@/lib/transport';
import { sendMail } from './send';
import {
  ticketCancelledEmail,
  ticketConfirmedEmail,
  transferAdminAlertEmail,
  transferReceivedEmail,
  transferRejectedEmail,
  type TicketMailData,
} from './templates';

async function loadTicket(ticketId: string) {
  const db = createAdminClient();
  const { data: t } = await db
    .from('tickets')
    .select(
      'id, buyer_name, buyer_email, buyer_document, buyer_instagram, source, tier_id, event_id, qr_token, amount_paid_uyu, payment_method, discount_uyu, discount_code_id, order_id',
    )
    .eq('id', ticketId)
    .single();
  if (!t?.qr_token) return null;

  // Compra de varias entradas (§5.2e): la entrada de quien compró apunta a sí misma.
  const leadId = t.order_id;
  const [{ data: event }, { data: tier }, { data: code }, bus, igHandle, { data: group }] = await Promise.all([
    db.from('events').select('title, date_start, location_name, location_url').eq('id', t.event_id).single(),
    t.tier_id
      ? db.from('ticket_tiers').select('name, price_uyu, entry_until').eq('id', t.tier_id).single()
      : Promise.resolve({ data: null }),
    t.discount_code_id
      ? db.from('discount_codes').select('code').eq('id', t.discount_code_id).single()
      : Promise.resolve({ data: null }),
    getTicketTransport(t.id),
    getIgHandle(),
    leadId
      ? db
          .from('tickets')
          .select('id, buyer_name, amount_paid_uyu, created_at')
          .or(`id.eq.${leadId},order_id.eq.${leadId}`)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: null }),
  ]);
  if (!event) return null;

  const total = Number(t.amount_paid_uyu);
  // Compra web: se desglosa entrada − descuento + transporte + cargo por servicio (solo
  // Mercado Pago). Si el desglose no da el total cobrado (p. ej. cambió el precio de la
  // tanda), se muestra solo el total.
  const method: PayMethod = t.payment_method ?? 'mercadopago';
  const q =
    t.source === 'purchase' && tier
      ? quote(Number(tier.price_uyu), Number(t.discount_uyu), method, bus?.price ?? 0)
      : null;
  const breakdownOk = !!q && q.total === total;

  const data: TicketMailData = {
    firstName: t.buyer_name.split(' ')[0],
    fullName: t.buyer_name,
    docTail: t.buyer_document.slice(-4),
    eventTitle: event.title,
    dateLong: formatLocal(event.date_start, "EEEE d 'de' MMMM · HH:mm 'hs'").replace(/^./, (c) => c.toUpperCase()),
    dateShort: formatLocal(event.date_start, 'dd.MM.yy'),
    entryLabel: t.source === 'invitation' ? 'Invitación' : (tier?.name ?? 'Entrada'),
    location: event.location_name || null,
    locationUrl: event.location_name ? mapsUrl(event.location_name, event.location_url) : null,
    ticketUrl: ticketUrl(t.qr_token),
    price: breakdownOk ? q!.price : null,
    discount: breakdownOk ? q!.discount : 0,
    discountCode: code?.code ?? null,
    fee: breakdownOk ? q!.fee : null,
    total,
    transport: bus,
    entryUntil: entryTime(tier?.entry_until),
    igHandle,
    boughtBy: leadId && leadId !== t.id ? (group?.find((g) => g.id === leadId)?.buyer_name ?? null) : null,
    group:
      leadId === t.id && group && group.length > 1
        ? {
            count: group.length,
            total: group.reduce((sum, g) => sum + Number(g.amount_paid_uyu), 0),
            people: group.map((g) => ({ name: g.buyer_name, total: Number(g.amount_paid_uyu) })),
          }
        : null,
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

export async function sendTransferReceivedMail(ticketId: string): Promise<boolean> {
  const loaded = await loadTicket(ticketId);
  if (!loaded) return false;
  const { subject, html, text } = transferReceivedEmail(loaded.data);
  return sendMail({ to: loaded.ticket.buyer_email, subject, html, text, log: { ticketId, type: 'transfer_received' } });
}

export async function sendTransferRejectedMail(ticketId: string): Promise<boolean> {
  const loaded = await loadTicket(ticketId);
  if (!loaded) return false;
  const { subject, html, text } = transferRejectedEmail(loaded.data);
  return sendMail({ to: loaded.ticket.buyer_email, subject, html, text, log: { ticketId, type: 'transfer_rejected' } });
}

// Aviso a los owners activos, con el comprobante adjunto para validarlo desde el celular.
export async function sendTransferAdminAlert(
  ticketId: string,
  receipt?: { content: Buffer; filename: string },
): Promise<boolean> {
  const loaded = await loadTicket(ticketId);
  if (!loaded) return false;
  const { data: owners } = await createAdminClient()
    .from('admins')
    .select('email')
    .eq('role', 'owner')
    .eq('active', true);
  const to = (owners ?? []).map((o) => o.email).filter(Boolean);
  if (to.length === 0) return false;

  const { subject, html, text } = transferAdminAlertEmail({
    ...loaded.data,
    instagram: loaded.ticket.buyer_instagram,
    adminUrl: `${appUrl()}/admin/confirmar`,
  });
  return sendMail({
    to: to.join(', '),
    subject,
    html,
    text,
    attachments: receipt ? [receipt] : undefined,
    log: { ticketId, type: 'transfer_admin_alert' },
  });
}
