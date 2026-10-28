// ============================================================
// Códigos de descuento. Ver docs/LOGICA_DE_NEGOCIO.md → "Códigos de descuento".
// ============================================================
// Cada código es de un evento. Puede ser un % o un monto fijo en pesos, con tope de usos y
// fecha de vencimiento opcionales. Esta función se usa para mostrar el precio con descuento
// antes de pagar; la garantía final (sin carreras por el último uso) la da create_ticket.
import { createAdminClient } from '@/lib/supabase/admin';

export type FoundDiscount = { id: string; code: string; kind: 'percent' | 'fixed'; value: number };

const CODE_PATTERN =/^[A-Z0-9_-]{3,30}$/;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Los códigos se guardan normalizados (mayúsculas, ver descuentos/actions.ts), así que se
// busca por igualdad exacta: con ilike, PostgREST toma `*` como comodín y "S*" encontraba
// STAFF500. La demora frena a quien prueba códigos al azar.
export async function findDiscount(eventId: string, rawCode: string): Promise<FoundDiscount | { error: string }> {
  const code = normalizeCode(rawCode);
  if (!code) return { error: 'Escribí el código.' };

  const reject = async (error: string) => {
    await sleep(400);
    return { error };
  };
  if (!CODE_PATTERN.test(code)) return reject('Ese código no existe.');

  const db = createAdminClient();
  const { data: row } = await db
    .from('discount_codes')
    .select('id, code, kind, value, max_uses, valid_until, active')
    .eq('event_id', eventId)
    .eq('code', code)
    .maybeSingle();

  if (!row || !row.active) return reject('Ese código no existe.');
  if (row.valid_until && new Date(row.valid_until) < new Date()) return reject('Ese código ya venció.');
  if (row.max_uses !== null) {
    const { data: uses } = await db.rpc('discount_code_uses', { p_code_id: row.id });
    if (((uses as number | null) ?? 0) >= row.max_uses) return reject('Ese código ya no tiene usos disponibles.');
  }
  return { id: row.id, code: row.code, kind: row.kind as 'percent' | 'fixed', value: Number(row.value) };
}

export function describeDiscount(d: { kind: string; value: number }): string {
  return d.kind === 'percent' ? `${d.value}% off` : `$${d.value.toLocaleString('es-UY')} off`;
}
