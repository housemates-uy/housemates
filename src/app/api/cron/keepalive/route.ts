import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supabase (plan gratis) pausa el proyecto tras una semana sin consultas.
// Vercel llama a esta ruta una vez por día (ver vercel.json) con una lectura mínima.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const { error } = await db.from('site_config').select('key').limit(1);
  if (error) return NextResponse.json({ ok: false }, { status: 503 });

  return NextResponse.json({ ok: true });
}
