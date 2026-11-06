import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
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

// Entrar a comprar (§3b): solo con un código de acceso. No hay más contraseña general
// (migración 0032). El acceso dura GATE_TTL_SECONDS desde que se puso el código.
export async function grantAccess(codeId: string): Promise<void> {
  const session = await getGateSession();
  session.accessCodeId = codeId;
  session.grantedAt = Date.now();
  await session.save();
}

export async function closeGateSession(): Promise<void> {
  (await getGateSession()).destroy();
}

// El código de acceso con el que entró esta persona, si sigue sirviendo y no pasó la hora.
export async function getSessionAccessCode(): Promise<AccessCodeState | null> {
  const session = await getGateSession();
  if (!session.accessCodeId || !session.grantedAt) return null;
  if (Date.now() - session.grantedAt > GATE_TTL_SECONDS * 1000) return null;
  return findAccessCode({ id: session.accessCodeId });
}

// Puede comprar: con un código al que le quedan entradas (las reservas sin terminar no
// cuentan: quien vuelve tiene que poder reintentar), o en modo local.
export async function hasGateAccess(): Promise<boolean> {
  if (isLocalNoAuth()) return true;
  const code = await getSessionAccessCode();
  return !!code && code.openLeft > 0;
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
