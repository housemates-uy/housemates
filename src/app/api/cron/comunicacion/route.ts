import { NextResponse } from 'next/server';
import { formatLocal } from '@/lib/events';
import { sendEventComms, type CommsKind } from '@/lib/mail/event-mails';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DAY_MS = 86_400_000;
// Margen para cortar antes del maxDuration de Vercel.
const BUDGET_MS = 240_000;

// Días entre dos fechas según el calendario de Montevideo (event − today).
function dayDiff(eventIso: string, now: Date) {
  const day = (iso: string) => Date.parse(`${formatLocal(iso, 'yyyy-MM-dd')}T00:00:00Z`);
  return Math.round((day(eventIso) - day(now.toISOString())) / DAY_MS);
}

// Vercel la llama una vez por día (ver vercel.json). Manda, a quien todavía no lo recibió:
//   - el recordatorio "Antes de ir" el día anterior al evento (y el mismo día, antes de que
//     empiece, para los que compraron después o quedaron pendientes);
//   - la encuesta el día siguiente (y el otro, por si quedaron pendientes), ya terminado.
// Es idempotente: quién ya recibió cada mail sale de email_log.
export async function GET(req: Request) {
  // A diferencia del keepalive, sin CRON_SECRET solo responde en desarrollo: esta ruta manda mails.
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get('authorization') === `Bearer ${secret}`
    : process.env.NODE_ENV === 'development';
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const { data: events, error } = await createAdminClient()
    .from('events')
    .select('id, status, date_start, date_end')
    .neq('status', 'draft')
    .gte('date_start', new Date(now.getTime() - 4 * DAY_MS).toISOString())
    .lte('date_start', new Date(now.getTime() + 3 * DAY_MS).toISOString())
    .order('date_start', { ascending: true });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });

  const deadline = Date.now() + BUDGET_MS;
  const results: ({ event: string; kind: CommsKind } & Awaited<ReturnType<typeof sendEventComms>>)[] = [];

  for (const event of events ?? []) {
    const diff = dayDiff(event.date_start, now);
    let kind: CommsKind | null = null;
    if (event.status === 'published' && (diff === 1 || (diff === 0 && now < new Date(event.date_start)))) {
      kind = 'reminder';
    } else if ((diff === -1 || diff === -2) && now > new Date(event.date_end)) {
      kind = 'survey';
    }
    if (!kind) continue;

    const budgetMs = deadline - Date.now();
    if (budgetMs <= 0) break;
    try {
      results.push({ event: event.id, kind, ...(await sendEventComms(event.id, kind, { budgetMs })) });
    } catch (err) {
      console.error('[cron/comunicacion] falló', event.id, kind, (err as Error)?.message);
    }
  }

  return NextResponse.json({ ok: true, results });
}
