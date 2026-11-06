import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CUSTOM_CODE,
  ensureDeviceId,
  findAccessCode,
  normalizeAccessCode,
} from '@/lib/access-codes';
import { grantAccess } from '@/lib/auth/gate';
import { allowAttempt, isBlocked, TOO_MANY_ATTEMPTS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  code: z.string().trim().min(1).max(40),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Entrar con un código de acceso (§3b). Cuentan para el límite por IP solo los intentos
// fallidos (mucha gente comparte IP y pone bien el código a la vez); una IP en el tope no
// prueba ni uno más, aunque sea el correcto. El límite falla cerrado.
export async function POST(req: Request) {
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

  const tooMany = () =>
    NextResponse.json({ error: 'too_many_attempts', message: TOO_MANY_ATTEMPTS }, { status: 429 });
  if (await isBlocked('access_code')) return tooMany();

  const typed = normalizeAccessCode(parsed.data.code);
  const code = CUSTOM_CODE.test(typed) ? await findAccessCode({ code: typed }) : null;
  if (!code) {
    if (!(await allowAttempt('access_code'))) return tooMany();
    await sleep(500);
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  }
  if (code.openLeft === 0) return NextResponse.json({ error: 'code_exhausted' }, { status: 409 });

  await grantAccess(code.id);
  ensureDeviceId();
  return NextResponse.json({ ok: true });
}
