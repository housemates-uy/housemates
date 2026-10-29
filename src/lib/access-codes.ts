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
  used: number;
  left: number;
  validUntil: string | null;
};

// Un código que sirve para entrar a comprar: existe, está activo, no venció y su evento no
// terminó. `left` puede ser 0 (ya se usaron todas sus entradas): ahí ya no da acceso.
export async function findAccessCode(
  by: { code: string } | { id: string },
): Promise<AccessCodeState | null> {
  const db = createAdminClient();
  let query = db
    .from('access_codes')
    .select('id, event_id, code, label, max_uses, valid_until, active, events!inner(date_end)');
  query = 'code' in by ? query.eq('code', normalizeAccessCode(by.code)) : query.eq('id', by.id);
  const { data } = await query.maybeSingle();
  if (!data || !data.active) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  // Terminado el evento, sus códigos dejan de servir.
  const event = data.events as unknown as { date_end: string } | null;
  if (!event || new Date(event.date_end) < new Date()) return null;
  const { data: used } = await db.rpc('access_code_uses', { p_code_id: data.id });
  const usedCount = (used as number | null) ?? 0;
  return {
    id: data.id,
    eventId: data.event_id,
    code: data.code,
    label: data.label,
    maxUses: data.max_uses,
    used: usedCount,
    left: Math.max(data.max_uses - usedCount, 0),
    validUntil: data.valid_until,
  };
}
