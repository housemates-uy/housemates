// ============================================================
// Mercado Pago (Checkout Pro). Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web".
// ============================================================
// Checkout Pro = redirigimos a la página de pago de Mercado Pago. La persona paga ahí con
// lo que quiera (tarjeta, débito, saldo MP, Abitab/RedPagos). Nosotros nunca vemos datos
// de tarjeta. Al terminar, MP la devuelve a /compra/resultado y nos avisa por webhook.
import { createHmac, timingSafeEqual } from 'crypto';
import { MercadoPagoConfig, Payment, PaymentRefund, Preference } from 'mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
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
  payerEmail: string;
  payerName: string;
  expiresAt: Date;
}): Promise<{ id: string; initPoint: string }> {
  const base = appUrl();
  const pref = await new Preference(client()).create({
    body: {
      // Dos líneas para que Mercado Pago muestre el desglose: entrada + cargo por servicio.
      items: [
        { id: params.ticketId, title: params.title, quantity: 1, unit_price: params.price, currency_id: 'UYU' },
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
// Si está aprobado, confirma la entrada (idempotente).
export async function syncPayment(paymentId: string): Promise<{
  ticketId: string | null;
  status: string;
  result?: string;
}> {
  const payment = await new Payment(client()).get({ id: paymentId });
  const ticketId = payment.external_reference ?? null;
  const status = payment.status ?? 'unknown';

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
    return { ticketId, status, result: data as string };
  }
  return { ticketId, status };
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
