import { NextResponse } from 'next/server';
import { BAR_ACCESS_COOKIE, BAR_ACCESS_TTL_SECONDS, BAR_KEY_PATTERN } from '@/lib/bar-access';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Lo que abre el QR impreso en la fiesta o el link de las historias: deja la cookie de la
// barra para ese evento y manda a /barra. Con una clave que no existe (o un link viejo) va a
// /barra sin cookie, que explica cómo se entra.
export async function GET(_request: Request, { params }: { params: { key: string } }) {
  // Location relativa: con request.url, `next dev` redirige a localhost aunque se haya entrado
  // por 127.0.0.1, y la cookie queda en el otro host.
  const response = new NextResponse(null, { status: 303, headers: { Location: '/barra' } });
  const key = params.key.toLowerCase();
  if (!BAR_KEY_PATTERN.test(key)) return response;

  const { data: event } = await createAdminClient().from('events').select('id').eq('bar_key', key).maybeSingle();
  if (event) {
    response.cookies.set(BAR_ACCESS_COOKIE, key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/barra',
      maxAge: BAR_ACCESS_TTL_SECONDS,
    });
  }
  return response;
}
