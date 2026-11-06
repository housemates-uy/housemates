// ============================================================
// Acceso a /barra: solo con el QR impreso en la fiesta o con el link de las historias.
// Explicación en docs/LOGICA_DE_NEGOCIO.md → "Barra" · migración 0031_bar_access.sql.
// ============================================================
// Cada evento tiene una clave al azar (events.bar_key). /barra/k/<clave> deja esta cookie y
// /barra y las acciones que arman el pedido la piden. La cookie guarda la clave: con "Cambiar
// link" las cookies del link viejo dejan de valer al instante. No se saltea en modo local.
import { randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/tickets';

export const BAR_ACCESS_COOKIE = 'hm_barra';
// Lo mismo que dura una historia de Instagram.
export const BAR_ACCESS_TTL_SECONDS = 24 * 60 * 60;
export const BAR_KEY_PATTERN = /^[0-9a-f]{16}$/;
export const BAR_LOCKED_MESSAGE =
  'La barra se abre con el QR de la fiesta o con el link de nuestras historias de Instagram.';

// Mismo formato que new_bar_key() en la base.
export function newBarKey(): string {
  return randomBytes(8).toString('hex');
}

export function barAccessUrl(key: string): string {
  return `${appUrl()}/barra/k/${key}`;
}

export async function hasBarAccess(eventId: string): Promise<boolean> {
  const value = cookies().get(BAR_ACCESS_COOKIE)?.value ?? '';
  if (!BAR_KEY_PATTERN.test(value)) return false;
  const { data } = await createAdminClient().from('events').select('bar_key').eq('id', eventId).maybeSingle();
  return !!data && timingSafeEqual(Buffer.from(data.bar_key), Buffer.from(value));
}
