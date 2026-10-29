import { NextResponse, type NextRequest } from 'next/server';
import { findAccessCode } from '@/lib/access-codes';
import { getGateSession } from '@/lib/auth/gate';
import { allowAttempt } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Link de un código de acceso (§3b): /acceso/K7P2QX9M. Si sirve, queda guardado en la cookie
// de acceso y lleva a comprar; si no, a /access con el motivo.
export async function GET(req: NextRequest, { params }: { params: { codigo: string } }) {
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!(await allowAttempt('access_code'))) return to('/access?next=/entradas&codigo=intentos');

  const code = await findAccessCode({ code: params.codigo });
  if (!code) return to('/access?next=/entradas&codigo=invalido');
  if (code.left === 0) return to('/access?next=/entradas&codigo=agotado');

  const session = await getGateSession();
  session.accessCodeId = code.id;
  await session.save();
  return to('/entradas');
}
