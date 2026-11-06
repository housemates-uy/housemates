'use server';

// Compra de barra. Ver docs/LOGICA_DE_NEGOCIO.md → "Barra".
//   0. Solo con la cookie que deja el QR de la fiesta o el link de las historias (bar-access).
//   1. La persona elige tragos y deja su email (nombre opcional). No hace falta cuenta; si
//      está logueada, el pedido se guarda con su user_id.
//   2. Se crea el pedido `pending` (create_bar_order calcula el total con los precios
//      vigentes) y se manda a pagar a Mercado Pago. Pasa a `paid` cuando MP confirma
//      (webhook o la página del pedido, adonde vuelve la persona).
//   3. Solo en modo local: "Simular pago" lo confirma como si MP lo hubiera aprobado.
import { isLocalNoAuth } from '@/lib/auth/local-mode';
import { barCartSchema, createBarOrder, groupUnits, loadBarOrderById, type BarCart } from '@/lib/bar';
import { BAR_LOCKED_MESSAGE, hasBarAccess } from '@/lib/bar-access';
import { getCustomer } from '@/lib/customers';
import { confirmBarOrder, createBarPreference, isMercadoPagoConfigured } from '@/lib/mercadopago';
import { getNextEvent } from '@/lib/next-event';
import { allowAttempt, TOO_MANY_ATTEMPTS } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

export type BarCheckoutInput = { email: string; name: string; items: { productId: string; quantity: number }[] };
export type BarCheckoutResult = { error: string; field?: 'email' | 'name' | 'items' } | { url: string };

type Prepared = { eventId: string; eventTitle: string; dateEnd: string; cart: BarCart; userId: string | null };

// La barra vende para el próximo evento (el mismo de la landing y /entradas). Si está
// pausada o terminó, create_bar_order lo rechaza.
async function prepare(input: BarCheckoutInput): Promise<Prepared | { error: string; field?: 'email' | 'name' | 'items' }> {
  const parsed = barCartSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0];
    return { error: issue.message, field: field === 'email' || field === 'name' ? field : 'items' };
  }

  const next = await getNextEvent();
  if (!next.id) return { error: 'La barra todavía no está abierta.' };
  const { data: event } = await createAdminClient()
    .from('events')
    .select('id, title, date_end')
    .eq('id', next.id)
    .single();
  if (!event) return { error: 'La barra todavía no está abierta.' };
  // La página sin la cookie del link no muestra la carta; esto frena a quien llame la acción directo.
  if (!(await hasBarAccess(event.id))) return { error: BAR_LOCKED_MESSAGE };

  // Cada intento crea un pedido en la base: se limita por IP una vez validado el carrito.
  if (!(await allowAttempt('bar_checkout'))) return { error: TOO_MANY_ATTEMPTS };

  const customer = await getCustomer().catch(() => null);
  return { eventId: event.id, eventTitle: event.title, dateEnd: event.date_end, cart: parsed.data, userId: customer?.id ?? null };
}

export async function startBarCheckoutAction(input: BarCheckoutInput): Promise<BarCheckoutResult> {
  // Igual que en /entradas: hasta conectar Mercado Pago no se crea nada ni se cobra.
  if (!isMercadoPagoConfigured()) return { error: 'El pago con Mercado Pago se habilita pronto.' };

  const prep = await prepare(input);
  if ('error' in prep) return prep;

  const order = await createBarOrder({ eventId: prep.eventId, cart: prep.cart, userId: prep.userId });
  if ('error' in order) return { error: order.error, field: 'items' };

  const db = createAdminClient();
  try {
    const full = await loadBarOrderById(order.id);
    if (!full) throw new Error('pedido no encontrado');
    const pref = await createBarPreference({
      orderId: order.id,
      accessToken: order.accessToken,
      eventTitle: prep.eventTitle,
      lines: groupUnits(full.units),
      payerEmail: prep.cart.email,
      payerName: prep.cart.name || null,
      expiresAt: new Date(prep.dateEnd),
    });
    await db.from('bar_orders').update({ mp_preference_id: pref.id }).eq('id', order.id);
    return { url: pref.initPoint };
  } catch {
    await db
      .from('bar_orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'pending');
    return { error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en un rato.' };
  }
}

// Solo para probar sin Mercado Pago: exige `npm run dev` + LOCAL_SIN_CLAVES=1
// (src/lib/auth/local-mode.ts). En Vercel y con `next start` NODE_ENV es 'production', así
// que esta acción no hace nada aunque alguien la llame directo.
export async function simulateBarCheckoutAction(input: BarCheckoutInput): Promise<BarCheckoutResult> {
  if (!isLocalNoAuth()) return { error: 'No disponible.' };

  const prep = await prepare(input);
  if ('error' in prep) return prep;

  const order = await createBarOrder({ eventId: prep.eventId, cart: prep.cart, userId: prep.userId });
  if ('error' in order) return { error: order.error, field: 'items' };

  const result = await confirmBarOrder(order.id, null, null);
  if (result !== 'confirmed') return { error: 'No se pudo simular el pago.' };
  return { url: `/barra/pedido/${order.accessToken}` };
}
