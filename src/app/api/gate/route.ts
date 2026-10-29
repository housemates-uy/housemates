import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { findAccessCode, normalizeAccessCode } from '@/lib/access-codes';
import { getGatePassword, getGateSession, gateVersion } from '@/lib/auth/gate';
import { allowAttempt, TOO_MANY_ATTEMPTS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Se recorta: un espacio que se arrastra al copiar la contraseña de un mensaje no la invalida.
const bodySchema = z.object({
  password: z.string().trim().min(1).max(200),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    const dummy = Buffer.alloc(aBuf.length, 0);
    timingSafeEqual(aBuf, dummy);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

// Lo que escribe la persona puede ser la contraseña o un código de acceso (§3b): un código
// son 8 letras y números (con o sin guion). Primero se prueba como código.
const CODE_SHAPE = /^[A-Z0-9]{8}$/;

export async function POST(req: Request) {
  const expected = await getGatePassword();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await sleep(500);
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    await sleep(500);
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const typed = parsed.data.password;
  if (CODE_SHAPE.test(normalizeAccessCode(typed))) {
    if (!(await allowAttempt('access_code'))) {
      return NextResponse.json({ error: 'too_many_attempts', message: TOO_MANY_ATTEMPTS }, { status: 429 });
    }
    const code = await findAccessCode({ code: typed });
    if (code) {
      if (code.left === 0) return NextResponse.json({ error: 'code_exhausted' }, { status: 409 });
      const session = await getGateSession();
      session.accessCodeId = code.id;
      await session.save();
      return NextResponse.json({ ok: true, kind: 'code' });
    }
  }

  if (!expected) {
    await sleep(500);
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  // 5 intentos cada 15 minutos por IP (CLAUDE.md §7.2), antes de comparar la contraseña.
  if (!(await allowAttempt('gate'))) {
    return NextResponse.json({ error: 'too_many_attempts', message: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  if (!safeEqual(typed, expected)) {
    await sleep(500);
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const session = await getGateSession();
  session.granted = true;
  session.grantedAt = Date.now();
  session.version = gateVersion(expected);
  await session.save();

  return NextResponse.json({ ok: true });
}
