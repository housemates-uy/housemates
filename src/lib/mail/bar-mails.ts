// Mail del pedido de barra: un QR por trago (adjuntos embebidos cid:qr1, cid:qr2…) y el link
// a la página del pedido. Se manda una sola vez, cuando el pago se confirma (confirmBarOrder
// en src/lib/mercadopago.ts).
import QRCode from 'qrcode';
import { barOrderUrl, barUnitUrl, groupUnits, loadBarOrderById } from '@/lib/bar';
import { formatLocal } from '@/lib/events';
import { getIgHandle } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from './send';
import { barOrderEmail } from './templates';

export async function sendBarOrderMail(orderId: string): Promise<boolean> {
  const order = await loadBarOrderById(orderId);
  if (!order || order.status !== 'paid' || order.units.length === 0) return false;
  const [{ data: event }, igHandle] = await Promise.all([
    createAdminClient().from('events').select('title, date_start').eq('id', order.eventId).single(),
    getIgHandle(),
  ]);
  if (!event) return false;

  const units = order.units.map((u, i) => ({ ...u, cid: `qr${i + 1}` }));
  const { subject, html, text } = barOrderEmail({
    firstName: order.name?.split(' ')[0] || null,
    eventTitle: event.title,
    dateShort: formatLocal(event.date_start, 'dd.MM.yy'),
    orderUrl: barOrderUrl(order.accessToken),
    lines: groupUnits(order.units),
    units: units.map((u) => ({ name: u.name, cid: u.cid })),
    total: order.total,
    igHandle,
  });
  const attachments = await Promise.all(
    units.map(async (u) => ({
      filename: `trago-${u.position}.png`,
      content: await QRCode.toBuffer(barUnitUrl(u.token), { width: 320, margin: 1, errorCorrectionLevel: 'M' }),
      cid: u.cid,
    })),
  );
  return sendMail({
    to: order.email,
    subject,
    html,
    text,
    attachments,
    log: { barOrderId: orderId, type: 'bar_order' },
  });
}
