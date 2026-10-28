'use server';

// Compra web. Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web".
//   1. Acceso (la contraseña, si está prendida en /admin/config) y datos de la persona.
//   2. Tanda + código de descuento + transporte (opcional) + medio de pago → precio final
//      (src/lib/pricing.ts). El lugar en el bus se reserva apenas se crea la entrada.
//   3a. Mercado Pago: reserva el lugar 20 min (`pending`) y manda a pagar. Pasa a `paid`
//       cuando MP confirma (webhook o página de resultado).
//   3b. Transferencia: reserva el lugar 15 min (`pending`), sube el comprobante y recién ahí
//       la entrada pasa a `review` (el lugar reservado) hasta que un owner la valida.
//   4. Cuenta (opcional, src/lib/customers.ts): con la compra ya hecha, la entrada queda en
//      la cuenta de la persona; si eligió contraseña, la cuenta se crea recién ahí.
import { redirect } from 'next/navigation';
import { hasGateAccess } from '@/lib/auth/gate';
import {
  accountExists,
  ensureProfile,
  getCustomer,
  openAccount,
  passwordSchema,
  type CustomerSession,
} from '@/lib/customers';
import { describeDiscount, findDiscount, type FoundDiscount } from '@/lib/discounts';
import { sendTransferAdminAlert, sendTransferReceivedMail } from '@/lib/mail/ticket-mails';
import { createPreference } from '@/lib/mercadopago';
import { discountAmount, quote, type PayMethod } from '@/lib/pricing';
import { uploadReceipt, validateReceipt } from '@/lib/receipts';
import { allowAttempt, TOO_MANY_ATTEMPTS } from '@/lib/rate-limit';
import { getSaleConfig } from '@/lib/sale-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { buyerSchema, createTicket } from '@/lib/tickets';
import { findTransportChoice, reserveTransport } from '@/lib/transport';

const HOLD_MINUTES = 20;
// Lo que puede tardar en subirse el comprobante antes de que la reserva venza sola.
const TRANSFER_HOLD_MINUTES = 15;

export type CheckoutState = { error: string; field?: string; accountExists?: boolean } | null;

type SaleTier = { id: string; name: string; price: number; eventId: string; eventTitle: string };

// Solo se vende para eventos publicados, con ventas activas y que no terminaron.
async function loadSaleTier(tierId: string): Promise<SaleTier | null> {
  if (!/^[0-9a-f-]{36}$/.test(tierId)) return null;
  const { data: tier } = await createAdminClient()
    .from('ticket_tiers')
    .select('id, name, price_uyu, event_id, events!inner(id, title, status, sales_active, date_end)')
    .eq('id', tierId)
    .maybeSingle();
  const event = tier?.events as unknown as
    | { id: string; title: string; status: string; sales_active: boolean; date_end: string }
    | undefined;
  if (!tier || !event || event.status !== 'published' || !event.sales_active || new Date(event.date_end) < new Date()) {
    return null;
  }
  return { id: tier.id, name: tier.name, price: Number(tier.price_uyu), eventId: event.id, eventTitle: event.title };
}

export type DiscountCheck =
  | { ok: true; code: string; kind: 'percent' | 'fixed'; value: number; label: string }
  | { error: string };

// "Aplicar" el código en el formulario: muestra el precio con descuento antes de pagar.
export async function checkDiscountAction(tierId: string, rawCode: string): Promise<DiscountCheck> {
  if (!(await hasGateAccess())) return { error: 'Tu acceso venció. Recargá la página.' };
  const tier = await loadSaleTier(tierId);
  if (!tier) return { error: 'Elegí una tanda disponible.' };
  if (!(await allowAttempt('discount'))) return { error: TOO_MANY_ATTEMPTS };
  const found = await findDiscount(tier.eventId, rawCode);
  if ('error' in found) return found;
  if (discountAmount(tier.price, found) >= tier.price) return { error: 'Ese código no se puede usar en la compra web.' };
  return { ok: true, code: found.code, kind: found.kind, value: found.value, label: describeDiscount(found) };
}

export async function startCheckoutAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  // El acceso se vuelve a chequear acá: la página lo pidió, pero una acción del servidor
  // se puede llamar directo. Si rotaron la contraseña mientras completaba, vuelve a /access.
  if (!(await hasGateAccess())) redirect('/access?next=/entradas');

  const config = await getSaleConfig();
  const method: PayMethod = formData.get('method') === 'transfer' ? 'transfer' : 'mercadopago';
  if (method === 'mercadopago' && !config.mpEnabled) {
    return { error: 'El pago con Mercado Pago no está disponible.', field: 'method' };
  }
  // La opción se muestra antes de conectar Mercado Pago; hasta entonces no se cobra nada.
  if (method === 'mercadopago' && !config.mpReady) {
    return {
      error: 'El pago con Mercado Pago se habilita pronto. Por ahora podés pagar por transferencia.',
      field: 'method',
    };
  }
  if (method === 'transfer' && !config.transferEnabled) {
    return { error: 'El pago por transferencia no está disponible.', field: 'method' };
  }

  if (formData.get('accept') !== 'on') {
    return { error: 'Tenés que aceptar que la entrada es personal.', field: 'accept' };
  }

  // Con la sesión iniciada, la entrada va al email de la cuenta (el formulario no lo pide).
  const customer = await getCustomer();
  if (!customer && formData.get('as_account') === '1') {
    return { error: 'Tu sesión se cerró. Ingresá de nuevo para comprar con tu cuenta.' };
  }

  const parsed = buyerSchema.safeParse({
    name: formData.get('name'),
    email: customer ? customer.email : formData.get('email'),
    document: formData.get('document'),
    phone: formData.get('phone'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }

  // Contraseña opcional para crear la cuenta. Si ya hay una con ese email, no se cobra nada:
  // se le pide que ingrese.
  const password = customer ? '' : String(formData.get('password') ?? '');
  if (password) {
    const checked = passwordSchema.safeParse(password);
    if (!checked.success) return { error: checked.error.issues[0].message, field: 'password' };
  }

  // Después de las validaciones del formulario (un error de tipeo no gasta intentos) y
  // antes de todo lo que consulta la base: cuentas, códigos y la creación de la entrada.
  if (!(await allowAttempt('checkout'))) return { error: TOO_MANY_ATTEMPTS };

  if (password && (await accountExists(parsed.data.email))) {
    return { error: 'Ya tenés cuenta con este email.', field: 'password', accountExists: true };
  }

  const tier = await loadSaleTier(String(formData.get('tier') ?? ''));
  if (!tier) return { error: 'Esa tanda no está a la venta.', field: 'tier' };

  // Código de descuento (opcional). Si no sirve, se avisa y no se cobra nada.
  const rawCode = String(formData.get('code') ?? '').trim();
  let code: FoundDiscount | null = null;
  if (rawCode) {
    const found = await findDiscount(tier.eventId, rawCode);
    if ('error' in found) return { error: found.error, field: 'code' };
    code = found;
  }
  const discount = discountAmount(tier.price, code);
  if (code && discount >= tier.price) return { error: 'Ese código no se puede usar en la compra web.', field: 'code' };

  // Transporte (opcional): se suma al total y el descuento no lo toca.
  const bus = await findTransportChoice(tier.eventId, String(formData.get('transport') ?? ''));
  if ('error' in bus) return { error: bus.error, field: 'transport' };

  // amount_paid_uyu guarda el total que paga la persona (entrada + transporte + cargo).
  const price = quote(tier.price, discount, method, bus.option?.price ?? 0);

  let receipt: File | null = null;
  if (method === 'transfer') {
    const checked = validateReceipt(formData.get('receipt'));
    if ('error' in checked) return { error: checked.error, field: 'receipt' };
    receipt = checked.file;
  }

  // Las dos nacen `pending` con reserva. La transferencia pasa a `review` recién con el
  // comprobante subido: si algo se corta en el medio, la reserva vence sola y no queda una
  // entrada en revisión sin comprobante bloqueando la cédula, el email y el lugar.
  const ticket = await createTicket({
    eventId: tier.eventId,
    tierId: tier.id,
    source: 'purchase',
    status: 'pending',
    buyer: parsed.data,
    amount: price.total,
    holdMinutes: method === 'transfer' ? TRANSFER_HOLD_MINUTES : HOLD_MINUTES,
    paymentMethod: method,
    discountCodeId: code?.id ?? null,
    discountUyu: discount,
    presaleCode: String(formData.get('presale') ?? '') || null,
  });
  if ('error' in ticket) {
    if (customer && ticket.code === 'duplicate_email') {
      return { error: 'Ya tenés una entrada para esta fecha. La ves en Mi cuenta.' };
    }
    return { error: ticket.error, field: ticket.code?.startsWith('discount') ? 'code' : undefined };
  }

  // Si se llenó el bus mientras completaba, la entrada recién creada se borra y no se cobra nada.
  if (bus.option) {
    const reserved = await reserveTransport(ticket.id, bus.option);
    if ('error' in reserved) return { error: reserved.error, field: 'transport' };
  }

  const db = createAdminClient();

  if (method === 'transfer' && receipt) {
    const path = await uploadReceipt(tier.eventId, ticket.id, receipt);
    let inReview = false;
    if (path) {
      // `status = 'pending'`: si la reserva se anuló mientras subía (por ejemplo, la misma
      // persona volvió a intentar), no se revive.
      const { data, error } = await db
        .from('tickets')
        .update({ status: 'review', receipt_path: path, reserved_until: null })
        .eq('id', ticket.id)
        .eq('status', 'pending')
        .select('id');
      inReview = !error && !!data?.length;
    }
    if (!path || !inReview) {
      // Sin comprobante no hay nada que validar: se libera el lugar.
      await db.rpc('cancel_ticket', { p_ticket_id: ticket.id, p_refunded: false });
      return { error: 'No pudimos subir el comprobante. Probá de nuevo.', field: 'receipt' };
    }
    await attachAccount(ticket.id, parsed.data, customer, password);
    // Los mails nunca frenan la compra (sendMail no tira errores).
    const content = Buffer.from(await receipt.arrayBuffer());
    await Promise.all([
      sendTransferReceivedMail(ticket.id),
      sendTransferAdminAlert(ticket.id, { content, filename: `comprobante-${parsed.data.name}.${path.split('.').pop()}` }),
    ]);
    redirect(`/compra/resultado?transferencia=${ticket.id}`);
  }

  let initPoint: string;
  try {
    const pref = await createPreference({
      ticketId: ticket.id,
      title: `${tier.eventTitle} — ${tier.name}${code ? ` (código ${code.code})` : ''}`,
      price: price.subtotal,
      fee: price.fee,
      transport: bus.option ? { name: bus.option.name, price: price.transport } : undefined,
      payerEmail: parsed.data.email,
      payerName: parsed.data.name,
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
    });
    await db.from('tickets').update({ mp_preference_id: pref.id }).eq('id', ticket.id);
    initPoint = pref.initPoint;
  } catch {
    // Si MP falla, se libera la reserva para no bloquear el lugar ni a la persona.
    await db.rpc('cancel_ticket', { p_ticket_id: ticket.id, p_refunded: false });
    return { error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en un rato.' };
  }

  await attachAccount(ticket.id, parsed.data, customer, password);
  redirect(initPoint);
}

// Se llama con la compra ya hecha. Si algo falla acá, la compra sigue igual (sin cuenta).
async function attachAccount(
  ticketId: string,
  buyer: { name: string; email: string; document: string; phone?: string | null },
  customer: CustomerSession | null,
  password: string,
) {
  try {
    const customerId = customer
      ? await ensureProfile(customer, buyer)
      : password
        ? await openAccount(buyer, password)
        : null;
    if (customerId) {
      await createAdminClient().from('tickets').update({ customer_id: customerId }).eq('id', ticketId);
    }
  } catch (err) {
    console.error('[cuenta] no se pudo asociar la compra a una cuenta', (err as Error)?.message);
  }
}
