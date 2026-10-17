'use server';

// Compra web. Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web (Mercado Pago)".
//   1. Validar contraseña vigente + datos de la persona.
//   2. Reservar el lugar (entrada `pending`, 20 min) — create_ticket en Postgres.
//   3. Crear la preferencia en Mercado Pago y mandar a la persona a pagar.
// La entrada pasa a `paid` cuando MP confirma el pago (webhook o página de resultado).
import { redirect } from 'next/navigation';
import { hasGateAccess } from '@/lib/auth/gate';
import { createPreference, isMercadoPagoConfigured } from '@/lib/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { buyerSchema, createTicket } from '@/lib/tickets';

const HOLD_MINUTES = 20;

export type CheckoutState = { error: string; field?: string } | null;

export async function startCheckoutAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  // La contraseña se vuelve a chequear acá: la página la pidió, pero una acción del
  // servidor se puede llamar directo. Si la rotaron mientras completaba el form, vuelve a /access.
  if (!(await hasGateAccess())) redirect('/access?next=/entradas');
  if (!isMercadoPagoConfigured()) return { error: 'La venta online todavía no está habilitada.' };

  if (formData.get('accept') !== 'on') {
    return { error: 'Tenés que aceptar que la entrada es personal.', field: 'accept' };
  }

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

  const db = createAdminClient();
  const tierId = String(formData.get('tier') ?? '');
  const { data: tier } = await db
    .from('ticket_tiers')
    .select('id, name, price_uyu, event_id, events!inner(id, title, status, sales_active, date_end)')
    .eq('id', tierId)
    .maybeSingle();

  // Solo se vende para eventos publicados, con ventas activas y que no terminaron.
  const event = tier?.events as unknown as { id: string; title: string; status: string; sales_active: boolean; date_end: string } | undefined;
  if (!tier || !event || event.status !== 'published' || !event.sales_active || new Date(event.date_end) < new Date()) {
    return { error: 'Esa tanda no está a la venta.', field: 'tier' };
  }

  const ticket = await createTicket({
    eventId: event.id,
    tierId: tier.id,
    source: 'purchase',
    status: 'pending',
    buyer: parsed.data,
    amount: Number(tier.price_uyu),
    holdMinutes: HOLD_MINUTES,
  });
  if ('error' in ticket) return { error: ticket.error };

  let initPoint: string;
  try {
    const pref = await createPreference({
      ticketId: ticket.id,
      title: `${event.title} — ${tier.name}`,
      amount: Number(tier.price_uyu),
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

  redirect(initPoint);
}
