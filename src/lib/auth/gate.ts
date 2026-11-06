import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { GATE_COOKIE, GATE_TTL_SECONDS, type GateSession } from '@/lib/auth/gate-shared';
import { isLocalNoAuth } from '@/lib/auth/local-mode';
import { findAccessCode, type AccessCodeState } from '@/lib/access-codes';

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
  // `||` y no `??`: el seed inserta '' y ahí tiene que caer al env. Sin espacios en los
  // bordes, igual que lo que escribe la persona (/api/gate) y lo que guarda /admin/config.
  return data?.value?.trim() || process.env.GATE_PASSWORD?.trim() || null;
}

// La sesión guarda la huella de la contraseña con la que se entró. Al rotar la
// contraseña desde /admin/config, las cookies anteriores dejan de valer.
export function gateVersion(password: string): string {
  return createHash('sha256').update(password).digest('hex').slice(0, 16);
}

// La contraseña para comprar se prende y apaga desde /admin/config (site_config.gate_enabled).
// Solo se apaga con un '0' explícito: si falta la fila o la base falla, se pide.
export async function isGateEnabled(): Promise<boolean> {
  try {
    const { data } = await createAdminClient()
      .from('site_config')
      .select('value')
      .eq('key', 'gate_enabled')
      .maybeSingle();
    return data?.value !== '0';
  } catch {
    return true;
  }
}

// El código de acceso con el que entró esta persona (§3b), si sigue sirviendo. Vale aunque la
// contraseña esté apagada: la compra lo usa para descontar sus entradas.
export async function getSessionAccessCode(): Promise<AccessCodeState | null> {
  const session = await getGateSession();
  return session.accessCodeId ? findAccessCode({ id: session.accessCodeId }) : null;
}

// Puede comprar: con la contraseña (o sin que haga falta) o con un código de acceso al que le
// quedan entradas (las reservas sin terminar no cuentan: quien vuelve tiene que poder reintentar).
export async function hasGateAccess(): Promise<boolean> {
  if (await hasPasswordAccess()) return true;
  const code = await getSessionAccessCode();
  return !!code && code.openLeft > 0;
}

// Entró con la contraseña, o no hace falta (apagada o modo local). Sin esto, la compra tiene
// que ir con el código de acceso.
export async function hasPasswordAccess(): Promise<boolean> {
  if (isLocalNoAuth()) return true;
  if (!(await isGateEnabled())) return true;
  const session = await getGateSession();
  if (!session.granted || !session.version) return false;
  // La contraseña vale 24 h desde que se escribió (CLAUDE.md §7.2), aunque la cookie se haya
  // vuelto a guardar después (por ejemplo, al entrar un código de acceso).
  if (!session.grantedAt || Date.now() - session.grantedAt > GATE_TTL_SECONDS * 1000) return false;
  const password = await getGatePassword();
  return !!password && session.version === gateVersion(password);
}

// Solo paths internos, para que `?next=` no sirva de open redirect. Se resuelve como lo haría
// el navegador (que borra tabs y saltos de línea: "/\t/sitio.com" termina en "//sitio.com").
const SAME_ORIGIN = 'https://same-origin.invalid';
export function safeNextPath(next: string | undefined | null, fallback = '/entradas'): string {
  if (!next || !next.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, SAME_ORIGIN);
    // Los puntos también se resuelven: "/.//sitio.com" queda en "//sitio.com", otro sitio.
    if (url.origin !== SAME_ORIGIN || url.pathname.startsWith('//')) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
