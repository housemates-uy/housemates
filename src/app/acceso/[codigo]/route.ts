import { NextResponse, type NextRequest } from 'next/server';
import { CUSTOM_CODE, ensureDeviceId, findAccessCode, normalizeAccessCode } from '@/lib/access-codes';
import { grantAccess } from '@/lib/auth/gate';
import { allowAttempt } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Link de un código de acceso (§3b): /acceso/K7P2QX9M. Si sirve, queda guardado en la cookie
// de acceso (1 hora) y lleva a comprar; si no, a /access con el motivo.
export async function GET(req: NextRequest, { params }: { params: { codigo: string } }) {
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!(await allowAttempt('access_code'))) return to('/access?next=/entradas&codigo=intentos');

  const typed = normalizeAccessCode(params.codigo);
  const code = CUSTOM_CODE.test(typed) ? await findAccessCode({ code: typed }) : null;
  if (!code) return to('/access?next=/entradas&codigo=invalido');
  if (code.openLeft === 0) return to('/access?next=/entradas&codigo=agotado');

  await grantAccess(code.id);
  ensureDeviceId();
  return to('/entradas');
}
