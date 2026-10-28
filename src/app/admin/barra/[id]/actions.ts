'use server';

// Escáner de barra en dos pasos (ver docs/LOGICA_DE_NEGOCIO.md → "Barra"):
//   inspect → muestra qué trago es, no cambia nada
//   deliver → el barman lo entrega: marca ese QR como usado (atómico, una sola vez)
// Cualquier admin (owner o staff) puede usarlo.
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth/admin';
import { barCounts, parseBarScan } from '@/lib/bar';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail, normalizeEmail } from '@/lib/validation/email';

export type BarScanResult =
  | 'valid'
  | 'delivered'
  | 'already_delivered'
  | 'invalid'
  | 'wrong_event'
  | 'not_paid'
  | 'is_ticket'
  | 'list'
  | 'all_delivered'
  | 'not_found'
  | 'session_expired';

export type BarUnitView = { token: string; name: string; buyer: string | null; deliveredAt: string | null };

export type BarScanOutcome = {
  result: BarScanResult;
  unit?: BarUnitView;
  // Búsqueda por email: los tragos pendientes de esa persona en este evento.
  email?: string;
  buyer?: string | null;
  matches?: BarUnitView[];
  delivered: number;
  sold: number;
};

type UnitRow = {
  result: string;
  unit_id: string | null;
  product_name: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  delivered_at: string | null;
};

const device = () => headers().get('user-agent')?.slice(0, 200) ?? undefined;
const expired = (): BarScanOutcome => ({ result: 'session_expired', delivered: 0, sold: 0 });

async function toOutcome(eventId: string, token: string, row: UnitRow | null): Promise<BarScanOutcome> {
  const counts = await barCounts(eventId);
  if (!row) return { result: 'invalid', ...counts };
  return {
    result: row.result as BarScanResult,
    unit: row.unit_id
      ? {
          token,
          name: row.product_name ?? 'Trago',
          buyer: row.buyer_name || row.buyer_email,
          deliveredAt: row.delivered_at,
        }
      : undefined,
    ...counts,
  };
}

async function inspect(eventId: string, scanned: string, adminId: string): Promise<BarScanOutcome> {
  const parsed = parseBarScan(scanned);
  if ('ticket' in parsed) return { result: 'is_ticket', ...(await barCounts(eventId)) };
  const { data } = await createAdminClient().rpc('inspect_bar_unit', {
    p_token: parsed.token,
    p_event_id: eventId,
    p_admin_id: adminId,
    p_device: device(),
  });
  return toOutcome(eventId, parsed.token, (Array.isArray(data) ? data[0] : null) as UnitRow | null);
}

// Paso 1 con QR (o el código pegado a mano).
export async function inspectBarUnitAction(eventId: string, scanned: string): Promise<BarScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return expired();
  return inspect(eventId, scanned, admin.id);
}

// Paso 2: entregar. deliver_bar_unit garantiza una sola entrega aunque dos barmans toquen
// "Entregar" con el mismo QR a la vez (al segundo le da 'already_delivered' con la hora).
export async function deliverBarUnitAction(eventId: string, token: string): Promise<BarScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return expired();
  const { data } = await createAdminClient().rpc('deliver_bar_unit', {
    p_token: token,
    p_event_id: eventId,
    p_admin_id: admin.id,
    p_device: device(),
  });
  return toOutcome(eventId, token, (Array.isArray(data) ? data[0] : null) as UnitRow | null);
}

// Sin QR: por email muestra los tragos pendientes de esa persona; si no tiene arroba, se
// toma como el código (o la URL) de un QR.
export async function searchBarAction(eventId: string, query: string): Promise<BarScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return expired();
  const q = query.trim();
  if (!q.includes('@')) return inspect(eventId, q, admin.id);

  const counts = await barCounts(eventId);
  if (!isValidEmail(q)) return { result: 'not_found', email: q, ...counts };

  const db = createAdminClient();
  const { data: orders } = await db
    .from('bar_orders')
    .select('id, buyer_name, buyer_email')
    .eq('event_id', eventId)
    .eq('buyer_email_normalized', normalizeEmail(q))
    .eq('status', 'paid');
  if (!orders?.length) return { result: 'not_found', email: q, ...counts };

  const { data: units } = await db
    .from('bar_order_units')
    .select('order_id, product_name, qr_token, delivered_at, position')
    .in(
      'order_id',
      orders.map((o) => o.id),
    )
    .is('delivered_at', null)
    .order('position', { ascending: true });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const matches: BarUnitView[] = (units ?? []).map((u) => {
    const o = byId.get(u.order_id);
    return { token: u.qr_token, name: u.product_name, buyer: o?.buyer_name || o?.buyer_email || null, deliveredAt: null };
  });
  const buyer = orders.find((o) => o.buyer_name)?.buyer_name ?? orders[0].buyer_email;
  return { result: matches.length ? 'list' : 'all_delivered', email: orders[0].buyer_email, buyer, matches, ...counts };
}
