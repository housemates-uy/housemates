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
import { sendTicketConfirmedMail } from '@/lib/mail/ticket-mails';
import { appUrl } from '@/lib/tickets';

function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN no configurado');
  return new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
}

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

// Crea la "preferencia" (el carrito de MP) para una entrada ya reservada.
// external_reference = id de nuestra entrada: es lo que vincula el pago con la entrada.
// La preferencia vence junto con la reserva, así nadie paga una reserva ya liberada.
export async function createPreference(params: {
  ticketId: string;
  title: string;
  price: number;
  fee: number;
  transport?: { name: string; price: number };
  payerEmail: string;
  payerName: string;
  expiresAt: Date;
}): Promise<{ id: string; initPoint: string }> {
  const base = appUrl();
  const pref = await new Preference(client()).create({
    body: {
      // Una línea por concepto para que Mercado Pago muestre el desglose: entrada, transporte
      // (si eligió) y cargo por servicio.
      items: [
        { id: params.ticketId, title: params.title, quantity: 1, unit_price: params.price, currency_id: 'UYU' },
        ...(params.transport
          ? [
              {
                id: `${params.ticketId}-bus`,
                title: `Transporte · ${params.transport.name}`,
                quantity: 1,
                unit_price: params.transport.price,
                currency_id: 'UYU',
              },
            ]
          : []),
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
      statement_descriptor: 'HOUSE MATES',
    },
  });
  if (!pref.id || !pref.init_point) throw new Error('Mercado Pago no devolvió la preferencia');
  return { id: pref.id, initPoint: pref.init_point };
}

// Consulta el estado real de un pago a la API de MP. Nunca confiamos en lo que viene
// en la URL de vuelta ni en el cuerpo del webhook: siempre se pregunta a MP.
// Si está aprobado, confirma la entrada o el pedido de barra (idempotente). Los pedidos de
// barra se reconocen por el prefijo "bar:" del external_reference.
export async function syncPayment(paymentId: string): Promise<{
  ticketId: string | null;
  barOrderId: string | null;
  status: string;
  result?: string;
}> {
  const payment = await new Payment(client()).get({ id: paymentId });
  const ref = payment.external_reference ?? null;
  const status = payment.status ?? 'unknown';
  const barOrderId = ref?.startsWith(BAR_REF_PREFIX) ? ref.slice(BAR_REF_PREFIX.length) : null;
  const ticketId = barOrderId ? null : ref;

  if (barOrderId) {
    if (status !== 'approved') return { ticketId, barOrderId, status };
    const result = await confirmBarOrder(barOrderId, String(payment.id), payment.transaction_amount ?? null);
    return { ticketId, barOrderId, status, result };
  }

  if (ticketId && status === 'approved') {
    const db = createAdminClient();
    const { data } = await db.rpc('confirm_ticket_payment', {
      p_ticket_id: ticketId,
      p_payment_id: String(payment.id),
      p_amount: payment.transaction_amount ?? 0,
    });
    // Solo la llamada que efectivamente confirmó manda el mail (webhook y página de vuelta
    // pueden llegar los dos; la segunda recibe 'already_paid' y no reenvía).
    if (data === 'confirmed') await sendTicketConfirmedMail(ticketId);
    // MP informó menos que el total de la entrada: no se confirma ni se manda mail. Queda en
    // los logs para revisarlo a mano.
    if (data === 'amount_mismatch') {
      console.error('[mp] pago con monto menor al total, entrada sin confirmar', {
        ticketId,
        paymentId: String(payment.id),
        amount: payment.transaction_amount ?? null,
      });
    }
    return { ticketId, barOrderId, status, result: data as string };
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
  const { data } = await createAdminClient().rpc('confirm_bar_order_payment', {
    p_order_id: orderId,
    p_payment_id: paymentId ?? undefined,
    p_amount: amount ?? undefined,
  });
  if (data === 'confirmed') await sendBarOrderMail(orderId);
  if (data === 'amount_mismatch') {
    console.error('[mp] pago de barra con monto menor al total, pedido sin confirmar', { orderId, paymentId, amount });
  }
  return (data as string | null) ?? 'error';
}

export async function refundPayment(paymentId: string): Promise<boolean> {
  try {
    await new PaymentRefund(client()).create({ payment_id: paymentId, body: {} });
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
