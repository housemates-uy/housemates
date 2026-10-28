import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { getGatePassword, getGateSession, gateVersion } from '@/lib/auth/gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  password: z.string().min(1).max(200),
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

export async function POST(req: Request) {
  const expected = await getGatePassword();
  if (!expected) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

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

  if (!safeEqual(parsed.data.password, expected)) {
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
