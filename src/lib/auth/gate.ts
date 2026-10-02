import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { GATE_COOKIE, GATE_TTL_SECONDS, type GateSession } from '@/lib/auth/gate-shared';

export { GATE_COOKIE, GATE_TTL_SECONDS, type GateSession };

function getSecret(): string {
  const secret = process.env.GATE_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('GATE_COOKIE_SECRET missing or shorter than 32 chars');
  }
  return secret;
}

export function gateSessionOptions(): SessionOptions {
  return {
    cookieName: GATE_COOKIE,
    password: getSecret(),
    ttl: GATE_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: GATE_TTL_SECONDS,
    },
  };
}

export async function getGateSession() {
  return getIronSession<GateSession>(cookies(), gateSessionOptions());
}

export async function getGatePassword(): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from('site_config')
    .select('value')
    .eq('key', 'gate_password')
    .maybeSingle();
  // `||` y no `??`: el seed inserta '' y ahí tiene que caer al env.
  return data?.value || process.env.GATE_PASSWORD || null;
}

// La sesión guarda la huella de la contraseña con la que se entró. Al rotar la
// contraseña desde /admin/config, las cookies anteriores dejan de valer.
export function gateVersion(password: string): string {
  return createHash('sha256').update(password).digest('hex').slice(0, 16);
}

export async function hasGateAccess(): Promise<boolean> {
  const session = await getGateSession();
  if (!session.granted || !session.version) return false;
  const password = await getGatePassword();
  return !!password && session.version === gateVersion(password);
}

// Solo paths internos, para que `?next=` no sirva de open redirect.
export function safeNextPath(next: string | undefined | null, fallback = '/entradas'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
