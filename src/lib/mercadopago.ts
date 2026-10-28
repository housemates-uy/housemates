// ============================================================
// Mercado Pago (Checkout Pro). Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web".
// ============================================================
// Checkout Pro = redirigimos a la página de pago de Mercado Pago. La persona paga ahí con
// lo que quiera (tarjeta, débito, saldo MP, Abitab/RedPagos). Nosotros nunca vemos datos
// de tarjeta. Al terminar, MP la devuelve a /compra/resultado y nos avisa por webhook.
import { createHmac, timingSafeEqual } from 'crypto';
import { MercadoPagoConfig, Payment, PaymentRefund, Preference } from 'mercadopago';
import { BAR_REF_PREFIX } from '@/lib/bar';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBarOrderMail } from '@/lib/mail/bar-mails';
import { sendMail } from '@/lib/mail/send';
import { sendTicketCancelledMail, sendTicketConfirmedMail } from '@/lib/mail/ticket-mails';
import { appUrl } from '@/lib/tickets';

function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN no configurado');
  return new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
}

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

// Crea la "preferencia" (el carrito de MP) para una compra ya reservada: una o varias
// entradas (§5.2e) y el bus de cada una.
// external_reference = id de la entrada de quien compró: es lo que vincula el pago con el
// grupo. La preferencia vence junto con la reserva, así nadie paga una reserva ya liberada.
export async function createPreference(params: {
  ticketId: string;
  title: string;
  price: number;
  quantity: number;
  fee: number;
  transports: { name: string; price: number; quantity: number }[];
  payerEmail: string;
  payerName: string;
  expiresAt: Date;
}): Promise<{ id: string; initPoint: string }> {
  const base = appUrl();
  const pref = await new Preference(client()).create({
    body: {
      // Una línea por concepto para que Mercado Pago muestre el desglose: entradas,
      // transporte (por opción de bus) y cargo por servicio.
      items: [
        { id: params.ticketId, title: params.title, quantity: params.quantity, unit_price: params.price, currency_id: 'UYU' },
        ...params.transports.map((t, i) => ({
          id: `${params.ticketId}-bus-${i + 1}`,
          title: `Transporte · ${t.name}`,
          quantity: t.quantity,
          unit_price: t.price,
          currency_id: 'UYU',
        })),
        ...(params.fee > 0
          ? [{ id: `${params.ticketId}-fee`, title: 'Cargo por servicio', quantity: 1, unit_price: params.fee, currency_id: 'UYU' }]
          : []),
      ],
      payer: { email: params.payerEmail, name: params.payerName },
      external_reference: params.ticketId,
      back_urls: {
        success: `${base}/compra/resultado`,
        pending: `${base}/compra/resultado`,
        failure: `${base}/compra/resultado`,
      },
      auto_return: 'approved',
      // MP solo llama al webhook si la URL es pública (no localhost).
      notification_url: base.startsWith('https://') ? `${base}/api/mp/webhook` : undefined,
      expires: true,
      expiration_date_to: params.expiresAt.toISOString(),
      // Cupón de Abitab/RedPagos: mientras no venza, la reserva lo espera (syncPayment).
      date_of_expiration: new Date(Date.now() + CASH_VOUCHER_HOURS * 3_600_000).toISOString(),
      statement_descriptor: 'HOUSE MATES',
    },
  });
  if (!pref.id || !pref.init_point) throw new Error('Mercado Pago no devolvió la preferencia');
  return { id: pref.id, initPoint: pref.init_point };
}

const CASH_VOUCHER_HOURS = 24;
// Tarjeta "en revisión" de MP: puede tardar hasta dos días hábiles.
const PENDING_HOLD_HOURS = 48;
const MAX_HOLD_HOURS = 72;
const PENDING_STATUSES = new Set(['pending', 'in_process', 'authorized']);
const REVERSED_STATUSES = new Set(['refunded', 'charged_back']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Pagos que hay que resolver a mano (devolver plata o revisar). Docs: §5.2.
const PAYMENT_PROBLEMS = {
  duplicate_live_ticket:
    'Mercado Pago aprobó el pago de una reserva que ya estaba anulada, y la persona ya tiene otra entrada para esta fecha. Hay que devolver este pago desde Mercado Pago.',
  partial_duplicate:
    'Mercado Pago aprobó el pago de una compra de varias entradas, pero alguna de esas personas ya tenía otra entrada para esta fecha: esa quedó anulada. Las demás se confirmaron. Hay que devolver la parte de esa entrada desde Mercado Pago.',
  duplicate_payment:
    'Mercado Pago aprobó un segundo pago para una entrada que ya estaba paga. Hay que devolver este pago desde Mercado Pago.',
  amount_mismatch:
    'Mercado Pago informó un monto menor al total de la entrada. La entrada NO se confirmó: revisá el pago en Mercado Pago.',
  confirmed_late:
    'Se confirmó el pago de una entrada que estaba anulada (la anuló un admin o la persona volvió a intentar la compra). La entrada vale y se le mandó; revisá que la tanda no se haya pasado del cupo.',
  reversed: 'Mercado Pago informó una devolución o un contracargo: las entradas de ese pago se anularon y se le avisó a cada persona.',
  reversed_used:
    'Mercado Pago informó una devolución o un contracargo de una compra con entradas que ya se usaron en puerta. Esas entradas no se tocaron.',
};
type PaymentProblem = keyof typeof PAYMENT_PROBLEMS;
const isPaymentProblem = (r: string): r is PaymentProblem => r in PAYMENT_PROBLEMS;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Aviso por mail a los owners, una sola vez por entrada (queda en email_log).
async function alertOwners(ticketId: string, problem: PaymentProblem, paymentId: string) {
  console.error('[mp] pago para revisar', { problem, ticketId, paymentId });
  const db = createAdminClient();
  const { count } = await db
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId)
    .eq('type', 'payment_alert')
    .eq('status', 'sent');
  if (count) return;
  const [{ data: owners }, { data: ticket }] = await Promise.all([
    db.from('admins').select('email').eq('role', 'owner').eq('active', true),
    db.from('tickets').select('buyer_name, buyer_email, buyer_document').eq('id', ticketId).maybeSingle(),
  ]);
  const to = (owners ?? []).map((o) => o.email).filter(Boolean);
  if (to.length === 0) return;
  const lines = [
    PAYMENT_PROBLEMS[problem],
    ticket ? `Comprador: ${ticket.buyer_name} · ${ticket.buyer_email} · CI ${ticket.buyer_document}` : '',
    `Pago de Mercado Pago: ${paymentId}`,
    `Entrada: ${ticketId}`,
  ].filter(Boolean);
  await sendMail({
    to: to.join(', '),
    subject: 'Pago para revisar · House Mates',
    text: lines.join('\n'),
    html: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(''),
    log: { ticketId, type: 'payment_alert' },
  });
}

// Consulta el estado real de un pago a la API de MP. Nunca confiamos en lo que viene
// en la URL de vuelta ni en el cuerpo del webhook: siempre se pregunta a MP.
// - Aprobado: confirma la entrada o el pedido de barra (idempotente).
// - Pendiente (efectivo, tarjeta en revisión): la reserva espera al pago.
// - Devuelto o contracargo: anula la entrada pagada con ese pago.
// Si la base falla, tira error: el webhook responde 500 y MP vuelve a avisar.
// Los pedidos de barra se reconocen por el prefijo "bar:" del external_reference.
export async function syncPayment(paymentId: string): Promise<{
  ticketId: string | null;
  barOrderId: string | null;
  status: string;
  result?: string;
}> {
  const payment = await new Payment(client()).get({ id: paymentId });
  const ref = payment.external_reference ?? null;
  const status = payment.status ?? 'unknown';
  const mpId = String(payment.id);
  const barOrderId = ref?.startsWith(BAR_REF_PREFIX) ? ref.slice(BAR_REF_PREFIX.length) : null;
  const ticketId = !barOrderId && ref && UUID.test(ref) ? ref : null;

  if (barOrderId) {
    if (status !== 'approved') return { ticketId, barOrderId, status };
    // Sin monto informado no se confirma (amount_mismatch), igual que las entradas.
    const result = await confirmBarOrder(barOrderId, mpId, payment.transaction_amount ?? 0);
    if (result === 'error') throw new Error(`confirm_bar_order_payment falló (${barOrderId})`);
    return { ticketId, barOrderId, status, result };
  }
  if (!ticketId) return { ticketId, barOrderId, status };

  const db = createAdminClient();

  // ticketId es la entrada de quien compró: el pago es de todo su grupo (§5.2e). Una
  // entrada sin grupo (las de antes) es un grupo de una.
  if (status === 'approved') {
    const { data, error } = await db.rpc('confirm_order_payment', {
      p_order_id: ticketId,
      p_payment_id: mpId,
      p_amount: payment.transaction_amount ?? 0,
    });
    if (error) throw new Error(`confirm_order_payment: ${error.message}`);
    const { result, confirmed = [] } = data as { result: string; confirmed?: string[] };
    // Solo la llamada que efectivamente confirmó manda los mails (webhook y página de vuelta
    // pueden llegar los dos; la segunda recibe 'already_paid' y no reenvía). A cada persona
    // le llega su entrada.
    await Promise.all(confirmed.map((id) => sendTicketConfirmedMail(id)));
    if (isPaymentProblem(result)) await alertOwners(ticketId, result, mpId);
    return { ticketId, barOrderId, status, result };
  }

  if (PENDING_STATUSES.has(status)) {
    const voucherEnds = payment.date_of_expiration ? Date.parse(payment.date_of_expiration) : NaN;
    const until = Math.min(
      Number.isNaN(voucherEnds) ? Date.now() + PENDING_HOLD_HOURS * 3_600_000 : voucherEnds,
      Date.now() + MAX_HOLD_HOURS * 3_600_000,
    );
    const { data, error } = await db.rpc('extend_order_hold', {
      p_order_id: ticketId,
      p_until: new Date(until).toISOString(),
    });
    if (error) throw new Error(`extend_order_hold: ${error.message}`);
    return { ticketId, barOrderId, status, result: data ? 'extended' : 'unchanged' };
  }

  if (REVERSED_STATUSES.has(status)) {
    const { data, error } = await db.rpc('reverse_order_payment', { p_order_id: ticketId, p_payment_id: mpId });
    if (error) throw new Error(`reverse_order_payment: ${error.message}`);
    const { cancelled = [], used = 0 } = data as { cancelled?: string[]; used?: number };
    await Promise.all(cancelled.map((id) => sendTicketCancelledMail(id, true)));
    if (cancelled.length) await alertOwners(ticketId, 'reversed', mpId);
    if (used) await alertOwners(ticketId, 'reversed_used', mpId);
    return { ticketId, barOrderId, status, result: cancelled.length ? 'cancelled' : used ? 'already_used' : 'ignored' };
  }

  return { ticketId, barOrderId, status };
}

// Pedido de barra: una línea por trago, al precio de la carta (sin cargo por servicio).
// Vuelve directo a la página del pedido, que confirma el pago igual que /compra/resultado.
// Vence cuando termina el evento: después ya no se puede retirar nada.
export async function createBarPreference(params: {
  orderId: string;
  accessToken: string;
  eventTitle: string;
  lines: { name: string; price: number; quantity: number }[];
  payerEmail: string;
  payerName: string | null;
  expiresAt: Date;
}): Promise<{ id: string; initPoint: string }> {
  const base = appUrl();
  const back = `${base}/barra/pedido/${params.accessToken}`;
  const pref = await new Preference(client()).create({
    body: {
      items: params.lines.map((l, i) => ({
        id: `${params.orderId}-${i + 1}`,
        title: `${l.name} · Barra ${params.eventTitle}`,
        quantity: l.quantity,
        unit_price: l.price,
        currency_id: 'UYU',
      })),
      payer: { email: params.payerEmail, name: params.payerName ?? undefined },
      external_reference: `${BAR_REF_PREFIX}${params.orderId}`,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      notification_url: base.startsWith('https://') ? `${base}/api/mp/webhook` : undefined,
      expires: true,
      expiration_date_to: params.expiresAt.toISOString(),
      statement_descriptor: 'HOUSE MATES',
    },
  });
  if (!pref.id || !pref.init_point) throw new Error('Mercado Pago no devolvió la preferencia');
  return { id: pref.id, initPoint: pref.init_point };
}

// Confirma un pedido de barra pago. Lo usan syncPayment (pago aprobado por Mercado Pago) y
// la simulación del modo local. Solo la llamada que confirmó manda el mail con los QRs.
export async function confirmBarOrder(orderId: string, paymentId: string | null, amount: number | null) {
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return 'not_found';
  const { data, error } = await createAdminClient().rpc('confirm_bar_order_payment', {
    p_order_id: orderId,
    p_payment_id: paymentId ?? undefined,
    p_amount: amount ?? undefined,
  });
  if (error) {
    console.error('[mp] no se pudo confirmar el pedido de barra', orderId, error.message);
    return 'error';
  }
  if (data === 'confirmed') await sendBarOrderMail(orderId);
  if (data === 'amount_mismatch') {
    console.error('[mp] pago de barra con monto menor al total, pedido sin confirmar', { orderId, paymentId, amount });
  }
  return (data as string | null) ?? 'error';
}

// Sin monto devuelve todo el pago. Con monto, solo esa parte: en una compra de varias
// entradas, reembolsar una devuelve lo que pagó esa entrada, no el grupo entero.
export async function refundPayment(paymentId: string, amount?: number): Promise<boolean> {
  try {
    await new PaymentRefund(client()).create({ payment_id: paymentId, body: amount ? { amount } : {} });
    return true;
  } catch {
    return false;
  }
}

// Verifica que el webhook venga de Mercado Pago (firma HMAC con la clave secreta de
// "Webhooks" del panel de MP). Formato documentado por MP:
//   x-signature: ts=<timestamp>,v1=<hmac>
//   mensaje firmado: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
export function verifyWebhookSignature(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !params.signature || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.signature.split(',').map((p) => p.split('=').map((s) => s.trim()) as [string, string]),
  );
  if (!parts.ts || !parts.v1) return false;

  const dataId = /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  let manifest = `id:${dataId};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  manifest += `ts:${parts.ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
