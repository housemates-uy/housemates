// ============================================================
// Códigos de acceso para comprar. Ver docs/LOGICA_DE_NEGOCIO.md → §3b.
// ============================================================
// Los owners generan en el admin un código para X entradas y se lo pasan a quien quiere ir
// (por Instagram). Se escribe en /access o se abre el link /acceso/<código>.
import { randomInt } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/tickets';

// Sin letras ni números que se confunden al dictarlos o copiarlos (O/0, I/1/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateAccessCode(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

// Lo que escribe la persona: sin guiones ni espacios, en mayúsculas.
export function normalizeAccessCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Para mostrarlo: "K7P2-QX9M".
export function formatAccessCode(code: string): string {
  return code.length === LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function accessLink(code: string): string {
  return `${appUrl()}/acceso/${code}`;
}

export type AccessCodeState = {
  id: string;
  eventId: string;
  code: string;
  label: string;
  maxUses: number;
  used: number; // entradas que ocupan un uso, incluidas las reservas sin pagar todavía
  left: number; // usos libres ahora
  // Usos libres sin contar las reservas sin terminar: alcanza con esto para dejar entrar. Si el
  // pago no salió, quien vuelve tiene que poder reintentar aunque su reserva siga viva.
  openLeft: number;
  validUntil: string | null;
};

// Un código que sirve para entrar a comprar: existe, está activo, no venció y es del evento que
// está a la venta (el próximo publicado, el mismo de /entradas). Un código de una fecha nueva en
// borrador, o de la siguiente, no abre la compra de la actual. `left` puede ser 0 (ya se usaron
// todas sus entradas): ahí ya no da acceso.
export async function findAccessCode(
  by: { code: string } | { id: string },
): Promise<AccessCodeState | null> {
  const db = createAdminClient();
  let query = db
    .from('access_codes')
    .select('id, event_id, code, label, max_uses, valid_until, active');
  query = 'code' in by ? query.eq('code', normalizeAccessCode(by.code)) : query.eq('id', by.id);
  const { data } = await query.maybeSingle();
  if (!data || !data.active) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  // Terminado el evento, sus códigos dejan de servir (el próximo publicado pasa a ser otro).
  const { data: onSale } = await db
    .from('events')
    .select('id')
    .eq('status', 'published')
    .gte('date_end', new Date().toISOString())
    .order('date_start', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!onSale || onSale.id !== data.event_id) return null;
  const [{ data: used }, { count: held }] = await Promise.all([
    db.rpc('access_code_uses', { p_code_id: data.id }),
    db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('access_code_id', data.id)
      .eq('status', 'pending')
      .gt('reserved_until', new Date().toISOString()),
  ]);
  const usedCount = (used as number | null) ?? 0;
  return {
    id: data.id,
    eventId: data.event_id,
    code: data.code,
    label: data.label,
    maxUses: data.max_uses,
    used: usedCount,
    left: Math.max(data.max_uses - usedCount, 0),
    openLeft: Math.max(data.max_uses - usedCount + (held ?? 0), 0),
    validUntil: data.valid_until,
  };
}

// Reservas vigentes de una compra (la última de este navegador, cookie hm_compra) que ocupan
// usos de un código: al reintentar se liberan (create_order), así que se le suman a lo que
// puede comprar.
export async function heldInOrder(codeId: string, orderId: string | undefined): Promise<number> {
  if (!orderId || !/^[0-9a-f-]{36}$/.test(orderId)) return 0;
  const { count } = await createAdminClient()
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('access_code_id', codeId)
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .gt('reserved_until', new Date().toISOString());
  return count ?? 0;
}
