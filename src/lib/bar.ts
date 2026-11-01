// ============================================================
// Barra: reglas compartidas por /barra, la página del pedido, el mail y el escáner.
// Explicación completa en docs/LOGICA_DE_NEGOCIO.md → "Barra".
// ============================================================
// Un pedido tiene un QR por unidad (2 Fernet + 1 Jäger = 3 QRs). Cada QR vale un trago y se
// entrega una sola vez. La lógica atómica (total, entrega única) vive en Postgres
// (supabase/migrations/0012_bar.sql).
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl, generateQrToken } from '@/lib/tickets';
import { isValidEmail, normalizeEmail } from '@/lib/validation/email';
import type { BarOrderStatus } from '@/types/database';

// Webhook y página de vuelta comparten Mercado Pago con las entradas: el external_reference
// de un pedido de barra es "bar:<id>"; el de una entrada, el id solo.
export const BAR_REF_PREFIX = 'bar:';
export const MAX_PER_PRODUCT = 20;
export const MAX_UNITS = 30;

// Página del pedido, con todos los QRs. Su token es distinto del de cada QR: compartir un
// QR (por ejemplo para invitarle un trago a alguien) no expone el resto del pedido.
export function barOrderUrl(accessToken: string): string {
  return `${appUrl()}/barra/pedido/${accessToken}`;
}

// Lo que codifica cada QR. Escaneado con la cámara del celular abre ese trago solo.
export function barUnitUrl(qrToken: string): string {
  return `${appUrl()}/barra/qr/${qrToken}`;
}

// El escáner recibe la URL del QR o el código pegado a mano. Avisa si es una entrada.
export function parseBarScan(scanned: string): { token: string } | { ticket: true } {
  const value = scanned.trim();
  if (/\/ticket\/[A-Za-z0-9_-]{10,64}/.test(value)) return { ticket: true };
  const match = value.match(/\/barra\/qr\/([A-Za-z0-9_-]{10,64})/);
  return { token: match ? match[1] : value };
}

export const barCartSchema = z
  .object({
    email: z.string().trim().refine(isValidEmail, 'Email inválido'),
    name: z.string().trim().max(60, 'Hasta 60 letras').optional().or(z.literal('')),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1).max(MAX_PER_PRODUCT, `Hasta ${MAX_PER_PRODUCT} de cada trago`),
        }),
      )
      .min(1, 'Elegí al menos un trago'),
  })
  .refine((d) => d.items.reduce((s, i) => s + i.quantity, 0) <= MAX_UNITS, {
    message: `Hasta ${MAX_UNITS} tragos por pedido`,
    path: ['items'],
  });
export type BarCart = z.output<typeof barCartSchema>;

const ERROR_MESSAGES: Record<string, string> = {
  bar_closed: 'La barra de este evento ya cerró.',
  bar_paused: 'La venta de la barra está pausada en este momento.',
  empty_order: 'Elegí al menos un trago.',
  product_unavailable: 'Uno de los tragos ya no está en la carta. Recargá la página.',
  invalid_quantity: `Hasta ${MAX_PER_PRODUCT} de cada trago.`,
  too_many: `Hasta ${MAX_UNITS} tragos por pedido.`,
};

// Crea el pedido `pending`. El total lo calcula `create_bar_order` con los precios vigentes.
export async function createBarOrder(params: {
  eventId: string;
  cart: BarCart;
  userId: string | null;
}): Promise<{ id: string; accessToken: string } | { error: string; code?: string }> {
  const units = params.cart.items.reduce((s, i) => s + i.quantity, 0);
  const accessToken = generateQrToken();
  const { data, error } = await createAdminClient().rpc('create_bar_order', {
    p_event_id: params.eventId,
    p_email: params.cart.email.toLowerCase(),
    p_email_norm: normalizeEmail(params.cart.email),
    p_name: params.cart.name || '',
    p_user_id: params.userId as string,
    p_access_token: accessToken,
    p_items: params.cart.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_unit_tokens: Array.from({ length: units }, generateQrToken),
  });
  if (error) {
    const known = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
    return { error: known ? ERROR_MESSAGES[known] : 'No se pudo armar el pedido. Probá de nuevo.', code: known };
  }
  return { id: data as string, accessToken };
}

// Foto de cada trago: bucket público `bar` (migración 0028). En bar_products.image_path va la
// ruta dentro del bucket; al duplicar un evento la carta nueva usa los mismos archivos.
export const BAR_BUCKET = 'bar';

export function barImageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/${BAR_BUCKET}/${path}`;
}

export type BarProduct = { id: string; name: string; description: string | null; price: number; image: string | null };

export async function getBarMenu(eventId: string): Promise<BarProduct[]> {
  const { data } = await createAdminClient()
    .from('bar_products')
    .select('id, name, description, price_uyu, image_path')
    .eq('event_id', eventId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price_uyu),
    image: barImageUrl(p.image_path),
  }));
}

export type BarUnit = {
  id: string;
  position: number;
  name: string;
  price: number;
  token: string;
  deliveredAt: string | null;
};

export type BarOrder = {
  id: string;
  eventId: string;
  status: BarOrderStatus;
  email: string;
  name: string | null;
  total: number;
  accessToken: string;
  createdAt: string;
  units: BarUnit[];
};

async function loadOrder(column: 'access_token' | 'id', value: string): Promise<BarOrder | null> {
  const db = createAdminClient();
  const { data: order } = await db
    .from('bar_orders')
    .select('id, event_id, status, buyer_email, buyer_name, total_uyu, access_token, created_at')
    .eq(column, value)
    .maybeSingle();
  if (!order) return null;
  const { data: units } = await db
    .from('bar_order_units')
    .select('id, position, product_name, unit_price_uyu, qr_token, delivered_at')
    .eq('order_id', order.id)
    .order('position', { ascending: true });
  return {
    id: order.id,
    eventId: order.event_id,
    status: order.status,
    email: order.buyer_email,
    name: order.buyer_name,
    total: Number(order.total_uyu),
    accessToken: order.access_token,
    createdAt: order.created_at,
    units: (units ?? []).map((u) => ({
      id: u.id,
      position: u.position,
      name: u.product_name,
      price: Number(u.unit_price_uyu),
      token: u.qr_token,
      deliveredAt: u.delivered_at,
    })),
  };
}

export const loadBarOrderByToken = (accessToken: string) => loadOrder('access_token', accessToken);
export const loadBarOrderById = (id: string) => loadOrder('id', id);

export type AccountBarOrder = {
  id: string;
  accessToken: string;
  eventTitle: string;
  eventStart: string;
  units: number;
  delivered: number;
};

// "Pedidos de barra" en /cuenta: los pagos hechos con la sesión iniciada (bar_orders.user_id).
// El userId sale de getUser() (src/lib/customers.ts → getCustomer), nunca del cliente.
// Del evento más nuevo al más viejo y, dentro de cada uno, el último pedido arriba.
export async function loadAccountBarOrders(userId: string): Promise<AccountBarOrder[]> {
  const { data } = await createAdminClient()
    .from('bar_orders')
    .select('id, access_token, created_at, events(title, date_start), bar_order_units(delivered_at)')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  return (data ?? [])
    .filter((o) => o.events)
    .map((o) => ({
      id: o.id,
      accessToken: o.access_token,
      eventTitle: o.events!.title,
      eventStart: o.events!.date_start,
      units: o.bar_order_units.length,
      delivered: o.bar_order_units.filter((u) => u.delivered_at).length,
    }))
    .sort((a, b) => new Date(b.eventStart).getTime() - new Date(a.eventStart).getTime());
}

// "2 × Fernet con Coca": agrupa las unidades por trago (y precio), en el orden del pedido.
export function groupUnits(units: Pick<BarUnit, 'name' | 'price'>[]) {
  const lines: { name: string; price: number; quantity: number }[] = [];
  for (const u of units) {
    const line = lines.find((l) => l.name === u.name && l.price === u.price);
    if (line) line.quantity += 1;
    else lines.push({ name: u.name, price: u.price, quantity: 1 });
  }
  return lines;
}

// Quien tenga el link ve el pedido: el email va parcial ("fa•••@gmail.com").
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}•••@${domain}`;
}

// Contador del escáner: "entregados X de Y" (tragos de pedidos pagos).
export async function barCounts(eventId: string): Promise<{ delivered: number; sold: number }> {
  const { data } = await createAdminClient().rpc('bar_summary', { p_event_id: eventId });
  return (data ?? []).reduce(
    (acc, r) => ({ delivered: acc.delivered + r.delivered, sold: acc.sold + r.sold }),
    { delivered: 0, sold: 0 },
  );
}

export const BAR_STATUS_LABELS: Record<BarOrderStatus, string> = {
  pending: 'Pago pendiente',
  paid: 'Pago',
  cancelled: 'Anulado',
  refunded: 'Reembolsado',
};
