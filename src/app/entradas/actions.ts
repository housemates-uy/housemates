'use server';

// Compra web. Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web".
//   1. Acceso (el código de acceso de la cookie, §3b) y datos de cada persona:
//      quien compra puede sumar entradas para sus amigos, cada una nominativa (§5.2e).
//   2. Tanda + código de descuento + transporte (opcional) + medio de pago → precio final
//      (src/lib/pricing.ts). El lugar en el bus se reserva apenas se crea la entrada.
//   3a. Mercado Pago: reserva el lugar 20 min (`pending`) y manda a pagar. Pasa a `paid`
//       cuando MP confirma (webhook o página de resultado).
//   3b. Transferencia: reserva el lugar 15 min (`pending`), sube el comprobante y recién ahí
//       la entrada pasa a `review` (el lugar reservado) hasta que un owner la valida.
//   4. Cuenta (opcional, src/lib/customers.ts): con la compra ya hecha, la entrada queda en
//      la cuenta de la persona; si eligió contraseña, la cuenta se crea recién ahí.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureDeviceId, hashedClientIp, heldInOrder } from '@/lib/access-codes';
import { closeGateSession, getSessionAccessCode, hasGateAccess } from '@/lib/auth/gate';
import { isLocalNoAuth } from '@/lib/auth/local-mode';
import {
  accountExists,
  ensureProfile,
  getCustomer,
  isAccountsEnabled,
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
import { buyerSchema, createOrder, normalizeDocument, PURCHASE_COOKIE, type OrderPerson } from '@/lib/tickets';
import { findTransportChoice } from '@/lib/transport';
import { normalizeEmail } from '@/lib/validation/email';
import { instagramRequiredSchema } from '@/lib/validation/schemas';

const HOLD_MINUTES = 20;
// Lo que puede tardar en subirse el comprobante antes de que la reserva venza sola.
const TRANSFER_HOLD_MINUTES = 15;

export type CheckoutState = { error: string; field?: string; accountExists?: boolean } | null;

// Con transferencia, la persona transfiere antes de enviar: si la compra no sale por algo que
// no puede corregir (sin lugar, código agotado, bus lleno), tiene que saber qué hacer con la plata.
const TRANSFER_NOTE = 'Si ya transferiste, escribinos por Instagram con el comprobante y lo resolvemos.';

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

// "Aplicar" el código en el formulario: muestra el precio con descuento antes de pagar. Cada
// entrada gasta un uso: si no alcanza para todas, se avisa acá y no recién al pagar.
export async function checkDiscountAction(tierId: string, rawCode: string, quantity = 1): Promise<DiscountCheck> {
  if (!(await hasGateAccess())) return { error: 'Tu acceso venció. Recargá la página.' };
  const tier = await loadSaleTier(tierId);
  if (!tier) return { error: 'Elegí una tanda disponible.' };
  if (!(await allowAttempt('discount'))) return { error: TOO_MANY_ATTEMPTS };
  const found = await findDiscount(tier.eventId, rawCode);
  if ('error' in found) return found;
  if (discountAmount(tier.price, found) >= tier.price) return { error: 'Ese código no se puede usar en la compra web.' };
  if (found.left !== null && found.left < quantity) {
    return { error: `Ese código alcanza para ${found.left} ${found.left === 1 ? 'entrada' : 'entradas'}: bajá la cantidad.` };
  }
  return { ok: true, code: found.code, kind: found.kind, value: found.value, label: describeDiscount(found) };
}

// Cada persona de la compra (§5.2e): la 1 es quien compra (campos sin sufijo, con celular);
// las demás, sus amigos: `name_2`, `document_2`, `email_2`, `transport_2`, …
const personField = (field: string, n: number) => (n === 1 ? field : `${field}_${n}`);
const formText = (formData: FormData, name: string) => String(formData.get(name) ?? '');

type Bus = { id: string; name: string; price: number } | null;

const perBuyerText = (n: number) =>
  n === 1
    ? 'Con este código podés sacar 1 entrada: si vienen amigos, cada uno saca la suya.'
    : `Con este código podés sacar hasta ${n} entradas.`;

// Un error de create_order ('<motivo>#<n>') → mensaje y campo de esa persona.
function orderError(
  err: { error: string; code?: string; person?: number },
  quantity: number,
  hasAccount: boolean,
  buses: Bus[],
): [string, string?] {
  const n = err.person ?? 1;
  const who = quantity > 1 ? `Entrada ${n}: ` : '';
  switch (err.code) {
    case 'duplicate_email':
      if (n === 1 && hasAccount) return ['Ya tenés una entrada para esta fecha. La ves en Mi cuenta.'];
      return [`${who}${err.error}`, personField('email', n)];
    case 'duplicate_document':
      return [`${who}${err.error}`, personField('document', n)];
    case 'sold_out':
      return n > 1
        ? [`${n - 1 === 1 ? 'Queda 1 lugar' : `Quedan ${n - 1} lugares`} para esta fecha: bajá la cantidad de entradas.`, 'quantity']
        : [err.error, 'tier'];
    case 'discount_exhausted':
      return n > 1
        ? [`El código de descuento alcanza para ${n - 1} ${n - 1 === 1 ? 'entrada' : 'entradas'}: bajá la cantidad o sacá el código.`, 'code']
        : [err.error, 'code'];
    case 'discount_invalid':
      return [err.error, 'code'];
    case 'access_exhausted':
      return n > 1
        ? [`Tu código de acceso alcanza para ${n - 1} ${n - 1 === 1 ? 'entrada' : 'entradas'}: bajá la cantidad.`, 'quantity']
        : ['Tu código de acceso ya no tiene entradas disponibles. Escribinos por Instagram.'];
    case 'access_invalid':
      return ['Tu código de acceso ya no es válido. Pedinos uno nuevo por Instagram.'];
    case 'access_per_buyer':
      return [perBuyerText(n - 1), 'quantity'];
    case 'access_device':
    case 'access_ip':
      return [`${err.error} Si es un error, escribinos por Instagram.`];
    case 'transport_full':
      return [
        `${who}No quedan lugares en el bus "${buses[n - 1]?.name ?? ''}". Elegí otra opción o seguí sin transporte.`,
        personField('transport', n),
      ];
    case 'transport_changed':
      return ['Cambió el precio del transporte. Recargá la página para ver el total nuevo.', personField('transport', n)];
    case 'transport_inactive':
      return [`${who}Esa opción de transporte ya no está disponible. Elegí otra o seguí sin transporte.`, personField('transport', n)];
    default:
      return [err.error];
  }
}

export async function startCheckoutAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  // El acceso se vuelve a chequear acá: la página lo pidió, pero una acción del servidor
  // se puede llamar directo. Si venció la hora de acceso mientras completaba, vuelve a /access.
  if (!(await hasGateAccess())) {
    const back = new URLSearchParams();
    const presale = formText(formData, 'presale');
    if (presale) back.set('preventa', presale);
    const here = back.toString() ? `/entradas?${back}` : '/entradas';
    redirect(`/access?next=${encodeURIComponent(here)}`);
  }

  const config = await getSaleConfig();
  const method: PayMethod = formData.get('method') === 'transfer' ? 'transfer' : 'mercadopago';
  if (method === 'mercadopago' && !config.mpEnabled) {
    return { error: 'El pago con Mercado Pago no está disponible.', field: 'method' };
  }
  // La opción se muestra antes de conectar Mercado Pago; hasta entonces no se cobra nada.
  if (method === 'mercadopago' && !config.mpReady) {
    return {
      error: config.transferEnabled
        ? 'El pago con Mercado Pago se habilita pronto. Por ahora podés pagar por transferencia.'
        : 'El pago con Mercado Pago se habilita pronto.',
      field: 'method',
    };
  }
  if (method === 'transfer' && !config.transferEnabled) {
    return { error: 'El pago por transferencia no está disponible.', field: 'method' };
  }

  const fail = (error: string, field?: string): CheckoutState => ({
    error: method === 'transfer' ? `${error} ${TRANSFER_NOTE}` : error,
    field,
  });

  const quantity = Number(formData.get('quantity') ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > config.maxPerOrder) {
    return { error: `Podés comprar hasta ${config.maxPerOrder} entradas por compra.`, field: 'quantity' };
  }

  if (formData.get('accept') !== 'on') {
    return {
      error: quantity > 1 ? 'Tenés que aceptar que las entradas son personales.' : 'Tenés que aceptar que la entrada es personal.',
      field: 'accept',
    };
  }

  // Con la sesión iniciada, la entrada de quien compra va al email de la cuenta. Con "Mi cuenta"
  // apagada (/admin/config) no hay sesión ni se crean cuentas.
  const [customer, accountsOn] = await Promise.all([getCustomer(), isAccountsEnabled()]);
  if (accountsOn && !customer && formData.get('as_account') === '1') {
    return { error: 'Tu sesión se cerró. Ingresá de nuevo para comprar con tu cuenta.' };
  }

  // Cada entrada es nominativa: nombre, cédula y email propios, sin repetirse en la compra, y
  // el Instagram de cada persona (obligatorio en la compra web: los owners miran el perfil).
  const people: OrderPerson['buyer'][] = [];
  for (let n = 1; n <= quantity; n++) {
    const instagram = instagramRequiredSchema.safeParse(formText(formData, personField('instagram', n)));
    const parsed = buyerSchema.safeParse({
      name: formText(formData, personField('name', n)),
      email: n === 1 && customer ? customer.email : formText(formData, personField('email', n)),
      document: formText(formData, personField('document', n)),
      phone: n === 1 ? formText(formData, 'phone') : '',
      instagram: instagram.success ? instagram.data : '',
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { error: n === 1 ? issue.message : `Entrada ${n}: ${issue.message}`, field: personField(String(issue.path[0]), n) };
    }
    if (!instagram.success) {
      const message = instagram.error.issues[0].message;
      return { error: n === 1 ? message : `Entrada ${n}: ${message}`, field: personField('instagram', n) };
    }
    const email = normalizeEmail(parsed.data.email);
    const document = normalizeDocument(parsed.data.document);
    const twin = people.findIndex((p) => normalizeEmail(p.email) === email || normalizeDocument(p.document) === document);
    if (twin >= 0) {
      const sameEmail = normalizeEmail(people[twin].email) === email;
      return {
        error: `Entrada ${n}: ${sameEmail ? 'ese email' : 'esa cédula'} ya está en la entrada ${twin + 1}. Cada entrada es de una persona distinta.`,
        field: personField(sameEmail ? 'email' : 'document', n),
      };
    }
    people.push(parsed.data);
  }
  const buyer = people[0];

  // Contraseña opcional para crear la cuenta de quien compra. Si ya hay una con ese email,
  // no se cobra nada: se le pide que ingrese.
  const password = customer || !accountsOn ? '' : formText(formData, 'password');
  if (password) {
    const checked = passwordSchema.safeParse(password);
    if (!checked.success) return { error: checked.error.issues[0].message, field: 'password' };
  }

  // Después de las validaciones del formulario (un error de tipeo no gasta intentos) y
  // antes de todo lo que consulta la base: cuentas, códigos y la creación de las entradas.
  if (!(await allowAttempt('checkout', quantity))) return fail(TOO_MANY_ATTEMPTS);

  if (password && (await accountExists(buyer.email))) {
    return { error: 'Ya tenés cuenta con este email.', field: 'password', accountExists: true };
  }

  const tier = await loadSaleTier(formText(formData, 'tier'));
  if (!tier) return fail('Esa tanda no está a la venta.', 'tier');

  // Código de descuento (opcional): se aplica a cada entrada y cada una gasta un uso.
  const rawCode = formText(formData, 'code').trim();
  let code: FoundDiscount | null = null;
  if (rawCode) {
    const found = await findDiscount(tier.eventId, rawCode);
    if ('error' in found) return fail(found.error, 'code');
    code = found;
  }
  const discount = discountAmount(tier.price, code);
  if (code && discount >= tier.price) return fail('Ese código no se puede usar en la compra web.', 'code');

  // Transporte de cada persona (opcional): se suma a su entrada y el descuento no lo toca.
  const buses: Bus[] = [];
  for (let n = 1; n <= quantity; n++) {
    const bus = await findTransportChoice(tier.eventId, formText(formData, personField('transport', n)));
    if ('error' in bus) return fail(n === 1 ? bus.error : `Entrada ${n}: ${bus.error}`, personField('transport', n));
    buses.push(bus.option);
  }

  // Lo que paga cada entrada (amount_paid_uyu): entrada con descuento + su bus + su cargo.
  const prices = buses.map((bus) => quote(tier.price, discount, method, bus?.price ?? 0));
  const total = prices.reduce((sum, p) => sum + p.total, 0);

  // Si el precio de la tanda o del bus cambió mientras completaba, no se cobra un total
  // distinto al que vio (con transferencia, ya transfirió ese monto).
  const expected = formText(formData, 'expected_total');
  if (expected && Number(expected) !== total) {
    return fail('El precio cambió mientras completabas la compra. Recargá la página para ver el total actualizado.');
  }

  let receipt: File | null = null;
  if (method === 'transfer') {
    const checked = validateReceipt(formData.get('receipt'));
    if ('error' in checked) return { error: checked.error, field: 'receipt' };
    receipt = checked.file;
  }

  // Código de acceso (§3b): el de la cookie, nunca uno que mande el formulario. Sin código no
  // se compra (salvo el modo local). create_order controla los usos y el límite por persona
  // (por compra, dispositivo e IP), así no se compra de más llamando a la acción directo.
  const sessionCode = await getSessionAccessCode();
  const accessCode = sessionCode && sessionCode.eventId === tier.eventId ? sessionCode : null;
  if (!accessCode && !isLocalNoAuth()) {
    return fail('Tu código de acceso no es de esta fecha. Pedinos uno nuevo por Instagram.');
  }
  if (accessCode) {
    const codeLeft = accessCode.left + (await heldInOrder(accessCode.id, cookies().get(PURCHASE_COOKIE)?.value));
    if (codeLeft === 0) return fail('Tu código de acceso ya no tiene entradas disponibles. Escribinos por Instagram.');
    if (accessCode.perBuyer !== null && quantity > accessCode.perBuyer) {
      return fail(perBuyerText(accessCode.perBuyer), 'quantity');
    }
  }
  const accessCodeId = accessCode?.id ?? null;

  // Todas nacen `pending` con reserva. La transferencia pasa a `review` recién con el
  // comprobante subido: si algo se corta en el medio, la reserva vence sola y no quedan
  // entradas en revisión sin comprobante bloqueando cédulas, emails y lugares.
  const order = await createOrder({
    eventId: tier.eventId,
    tierId: tier.id,
    paymentMethod: method,
    holdMinutes: method === 'transfer' ? TRANSFER_HOLD_MINUTES : HOLD_MINUTES,
    discountCodeId: code?.id ?? null,
    presaleCode: formText(formData, 'presale') || null,
    accessCodeId,
    accessDevice: accessCodeId ? ensureDeviceId() : null,
    accessIp: accessCodeId ? hashedClientIp() : null,
    people: people.map((person, i) => ({
      buyer: person,
      amount: prices[i].total,
      discountUyu: discount,
      transport: buses[i] ? { id: buses[i]!.id, price: buses[i]!.price } : null,
    })),
  });
  if ('error' in order) return fail(...orderError(order, quantity, !!customer, buses));

  const leadId = order.ids[0];
  const db = createAdminClient();
  const cancelOrder = () => Promise.all(order.ids.map((id) => db.rpc('cancel_ticket', { p_ticket_id: id, p_refunded: false })));
  cookies().set(PURCHASE_COOKIE, leadId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/compra',
    maxAge: 7 * 24 * 3600,
  });

  if (method === 'transfer' && receipt) {
    // Un comprobante para toda la compra: queda en cada entrada del grupo.
    const path = await uploadReceipt(tier.eventId, leadId, receipt);
    let inReview = false;
    if (path) {
      // `status = 'pending'`: si una reserva se anuló mientras subía (por ejemplo, la misma
      // persona volvió a intentar), no se revive y se anula la compra entera.
      const { data, error } = await db
        .from('tickets')
        .update({ status: 'review', receipt_path: path, reserved_until: null })
        .in('id', order.ids)
        .eq('status', 'pending')
        .select('id');
      inReview = !error && data?.length === order.ids.length;
    }
    if (!path || !inReview) {
      // Sin comprobante no hay nada que validar: se liberan los lugares.
      await cancelOrder();
      return { error: 'No pudimos subir el comprobante. Probá de nuevo: no hace falta transferir otra vez.', field: 'receipt' };
    }
    await attachAccount(leadId, buyer, customer, password);
    // Los mails nunca frenan la compra (sendMail no tira errores).
    const content = Buffer.from(await receipt.arrayBuffer());
    await Promise.all([
      sendTransferReceivedMail(leadId),
      sendTransferAdminAlert(leadId, { content, filename: `comprobante-${buyer.name}.${path.split('.').pop()}` }),
    ]);
    // Con la compra hecha, el acceso se cierra: para otra hay que volver a poner el código.
    await closeGateSession();
    redirect(`/compra/resultado?transferencia=${leadId}`);
  }

  // Mercado Pago: un solo pago para todo el grupo, con el desglose por línea.
  const transports = new Map<string, { name: string; price: number; quantity: number }>();
  for (const bus of buses) {
    if (!bus) continue;
    const line = transports.get(bus.id) ?? { name: bus.name, price: bus.price, quantity: 0 };
    line.quantity += 1;
    transports.set(bus.id, line);
  }
  let initPoint: string;
  try {
    const pref = await createPreference({
      ticketId: leadId,
      title: `${tier.eventTitle} — ${tier.name}${code ? ` (código ${code.code})` : ''}`,
      price: prices[0].subtotal,
      quantity,
      fee: prices.reduce((sum, p) => sum + p.fee, 0),
      transports: [...transports.values()],
      payerEmail: buyer.email,
      payerName: buyer.name,
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
    });
    await db.from('tickets').update({ mp_preference_id: pref.id }).in('id', order.ids);
    initPoint = pref.initPoint;
  } catch {
    // Si MP falla, se liberan las reservas para no bloquear los lugares ni a las personas.
    await cancelOrder();
    return { error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en un rato.' };
  }

  await attachAccount(leadId, buyer, customer, password);
  // Igual que la transferencia. Si el pago no sale, vuelve a poner el código y reintenta: su
  // reserva se libera al reintentar (create_order) y no le gasta otro uso.
  await closeGateSession();
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
