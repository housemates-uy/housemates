// ============================================================
// Códigos de acceso para comprar. Ver docs/LOGICA_DE_NEGOCIO.md → §3b.
// ============================================================
// Los owners generan en el admin un código y se lo pasan a quien quiere ir (por Instagram).
// Se escribe en /access o se abre el link /acceso/<código>. Dos tipos:
//   - personal: para una persona y sus amigos, con X entradas.
//   - público (una historia de Instagram): `perBuyer` entradas por persona (1 o más) y un
//     total opcional (sin tope = hasta que se pause, venza o termine el evento).
// "Por persona" lo controla create_order (migración 0032): por compra y por dispositivo
// (cookie hm_device). Por IP no: con datos móviles mucha gente comparte la misma.
import { randomInt, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/tickets';

// Sin letras ni números que se confunden al dictarlos o copiarlos (O/0, I/1/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateAccessCode(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

// Un código propio que eligen los owners (ej. HOUSEMATES): mismas letras que el check de la
// base (0021), de 6 a 16. Para uno personal conviene el generado: uno corto se adivina.
export const CUSTOM_CODE = /^[A-Z0-9]{6,16}$/;

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

export type AccessCodeKind = 'personal' | 'public';

export const ACCESS_KIND_LABELS: Record<AccessCodeKind, string> = {
  personal: 'Personal',
  public: 'Público',
};

export function parseAccessKind(value: unknown): AccessCodeKind {
  return value === 'public' ? 'public' : 'personal';
}

export type AccessCodeState = {
  id: string;
  eventId: string;
  code: string;
  label: string;
  kind: AccessCodeKind;
  maxUses: number | null; // null: público sin tope
  perBuyer: number | null; // null: personal (una persona compra todas)
  used: number; // entradas que ocupan un uso, incluidas las reservas sin pagar todavía
  left: number; // usos libres ahora (Infinity sin tope)
  // Usos libres sin contar las reservas sin terminar: alcanza con esto para dejar entrar. Si el
  // pago no salió, quien vuelve tiene que poder reintentar aunque su reserva siga viva.
  openLeft: number;
  validUntil: string | null;
};

// Cuántas entradas puede llevar una compra con el código, si le quedan `left`: el público,
// una sola (cada persona saca la suya); el personal, las que le quedan. create_order controla
// lo mismo en la base.
export function accessOrderLimit(code: { perBuyer: number | null }, left: number): number {
  return code.perBuyer === null ? left : Math.min(left, code.perBuyer);
}

// Dispositivo de quien compra con un código (§3b): un id al azar en una cookie de un año.
// Se crea al entrar con el código. Borrarla deja comprar otra vez desde el mismo celular,
// pero el de cédula y email sigue.
export const DEVICE_COOKIE = 'hm_device';

export function ensureDeviceId(): string {
  const jar = cookies();
  const current = jar.get(DEVICE_COOKIE)?.value;
  if (current && /^[0-9a-f-]{36}$/.test(current)) return current;
  const id = randomUUID();
  jar.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

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
    .select('id, event_id, code, label, kind, max_uses, per_buyer, valid_until, active');
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
  const max = data.max_uses ?? Infinity;
  return {
    id: data.id,
    eventId: data.event_id,
    code: data.code,
    label: data.label,
    kind: parseAccessKind(data.kind),
    maxUses: data.max_uses,
    perBuyer: data.per_buyer ?? null,
    used: usedCount,
    left: Math.max(max - usedCount, 0),
    openLeft: Math.max(max - usedCount + (held ?? 0), 0),
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
