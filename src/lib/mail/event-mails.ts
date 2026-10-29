// ============================================================
// Comunicación con quienes fueron a un evento. Ver docs/LOGICA_DE_NEGOCIO.md → "Comunicación".
// ============================================================
// - Encuesta del día después: a quienes entraron (`used`), con link a /encuesta/<token>.
// (Lo de "antes de ir" se comunica por Instagram: no hay mail de recordatorio.)
// Cada envío queda en email_log; quien ya tiene un envío `sent` de ese tipo no se repite
// (salvo "reenviar a todos", que usa `since` para no contar los envíos anteriores).
// Antes de mandar, cada entrada se reserva en email_log (send_key único, 0019): si dos
// envíos corren a la vez (dos owners, un doble clic o el cron), cada mail sale una sola vez.
// Lo usan el admin (resumen del evento) y el cron diario (/api/cron/comunicacion).
import { getIgHandle } from '@/lib/site';
import { createAdminClient, fetchAll } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/tickets';
import type { EmailType, TicketStatus } from '@/types/database';
import { sendMail } from './send';
import { MAIL_COLORS as C, blend, button, heading, layout, solid } from './templates';

export type CommsKind = 'survey';

const KINDS: Record<CommsKind, { status: TicketStatus; mailType: EmailType }> = {
  survey: { status: 'used', mailType: 'survey' },
};

// Gmail corta si se le abren muchas conexiones a la vez; 4 en paralelo alcanza para que
// unos cientos de mails entren en un solo envío.
const CONCURRENCY = 4;
// Si fallan varios seguidos (p. ej. se llegó al límite diario de Gmail), se corta.
const MAX_FAILS_IN_ROW = 5;
// Una reserva en 'sending' más vieja que esto es de un envío que se cortó (las funciones de
// Vercel duran 5 minutos como mucho): se puede volver a tomar.
const STALE_CLAIM_MS = 10 * 60_000;

export function surveyUrl(token: string): string {
  return `${appUrl()}/encuesta/${token}`;
}

// ---------- Plantillas ----------

export type SurveyMailData = { firstName: string; eventTitle: string; surveyUrl: string; igHandle?: string };

export function surveyEmail(d: SurveyMailData) {
  const subject = `¿Cómo la pasaste en ${d.eventTitle}?`;
  // Cada número abre la encuesta con ese puntaje ya elegido (no guarda nada: falta enviar).
  const scale = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<td width="20%" style="padding:0 4px;"><a href="${d.surveyUrl}?puntaje=${n}" style="display:block;${solid(C.ink)}border:1px solid ${C.bone};border-radius:10px;padding:14px 0;text-align:center;text-decoration:none;font-size:22px;font-weight:700;color:${C.bone};font-family:inherit;">${blend(String(n))}</a></td>`,
    )
    .join('');

  const inner = `${heading(
    'GRACIAS POR VENIR',
    `${d.firstName}, ¿cómo la pasaste?`,
    'Son tres preguntas y te lleva un minuto. Lo leemos todo para que la próxima sea mejor.',
  )}
<tr><td align="center" style="padding-top:28px;font-size:14px;color:${C.bone};">${blend('Del 1 al 5, ¿cómo la pasaste?')}</td></tr>
<tr><td style="padding-top:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${scale}</tr></table></td></tr>
<tr><td style="padding-top:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:${C.muted};">${blend('No me gustó')}</td>
<td align="right" style="font-size:12px;color:${C.muted};">${blend('Increíble')}</td>
</tr></table></td></tr>
${button(d.surveyUrl, 'Responder la encuesta')}`;

  const text = [
    `${d.firstName}, gracias por venir a ${d.eventTitle}.`,
    'Son tres preguntas y te lleva un minuto:',
    d.surveyUrl,
  ].join('\n');

  return { subject, html: layout(inner, 'Tres preguntas, un minuto.', d.igHandle), text };
}

// ---------- Destinatarios ----------

type Recipient = {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_document: string;
  qr_token: string | null;
  source: string;
  tier_id: string | null;
};

// Entradas en el estado que corresponde y cuáles ya recibieron el mail (envío `sent` del
// tipo, desde `since` si se pasa). Se trae todo de a páginas (PostgREST corta en 1000 filas).
// Si alguna consulta falla, se corta: mejor no mandar nada que mandarle de nuevo a todos.
export async function commsAudience(eventId: string, kind: CommsKind, since: string | null = null) {
  const db = createAdminClient();
  const { status, mailType } = KINDS[kind];

  const [all, logs] = await Promise.all([
    fetchAll<Recipient>((from, to) =>
      db
        .from('tickets')
        .select('id, buyer_name, buyer_email, buyer_document, qr_token, source, tier_id')
        .eq('event_id', eventId)
        .eq('status', status)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) => {
      let q = db
        .from('email_log')
        .select('ticket_id, tickets!inner(event_id)')
        .eq('tickets.event_id', eventId)
        .eq('type', mailType)
        .eq('status', 'sent');
      if (since) q = q.gte('sent_at', since);
      return q.order('sent_at', { ascending: true }).order('id', { ascending: true }).range(from, to);
    }),
  ]);

  const done = new Set(logs.map((l) => l.ticket_id));
  const pending = all.filter((t) => !done.has(t.id) && t.qr_token);
  return { total: all.length, received: all.length - pending.length, pending };
}

// ---------- Envío ----------

// skipped: los tenía otro envío que corría a la vez (no se cuentan como pendientes).
export type CommsResult = { sent: number; failed: number; skipped: number; left: number };

type Claim = { id: string } | 'taken' | 'error';

// Reserva la entrada antes de mandar: una fila en 'sending' con send_key único. Si ya hay una
// (otro envío la mandó o la está mandando), el insert no hace nada y este mail no sale. Una
// reserva en 'sending' que quedó colgada (STALE_CLAIM_MS) se vuelve a tomar.
async function claimSend(
  db: ReturnType<typeof createAdminClient>,
  ticketId: string,
  type: EmailType,
  key: string,
): Promise<Claim> {
  const { data, error } = await db
    .from('email_log')
    .upsert({ ticket_id: ticketId, type, status: 'sending', send_key: key }, { onConflict: 'send_key', ignoreDuplicates: true })
    .select('id');
  if (error) return 'error';
  if (data.length > 0) return data[0];
  const { data: stale, error: staleError } = await db
    .from('email_log')
    .update({ sent_at: new Date().toISOString() })
    .eq('send_key', key)
    .eq('status', 'sending')
    .lt('sent_at', new Date(Date.now() - STALE_CLAIM_MS).toISOString())
    .select('id');
  if (staleError) return 'error';
  return stale[0] ?? 'taken';
}

// Manda a los pendientes hasta terminar o hasta agotar `budgetMs` (las funciones de
// Vercel tienen tiempo máximo). Lo que queda se manda en el próximo envío: no duplica.
export async function sendEventComms(
  eventId: string,
  kind: CommsKind,
  opts: { budgetMs: number; since?: string | null },
): Promise<CommsResult> {
  const startedAt = Date.now();
  const db = createAdminClient();
  const since = opts.since ?? null;
  const [{ data: event, error }, audience, igHandle] = await Promise.all([
    db.from('events').select('id, title').eq('id', eventId).single(),
    commsAudience(eventId, kind, since),
    getIgHandle(),
  ]);
  if (error || !event) throw error ?? new Error('Evento no encontrado');

  const { mailType } = KINDS[kind];
  const queue = audience.pending;

  async function deliver(t: Recipient): Promise<boolean> {
    const token = t.qr_token!;
    const firstName = t.buyer_name.split(' ')[0];
    const mail = surveyEmail({ firstName, eventTitle: event!.title, surveyUrl: surveyUrl(token), igHandle });
    return sendMail({ to: t.buyer_email, ...mail });
  }

  // La vuelta del send_key: "Mandar" y el cron comparten la misma; cada "Reenviar a todos"
  // tiene la suya (`since`), y "Seguir reenviando" reusa la del reenvío que continúa.
  async function sendOne(t: Recipient): Promise<'sent' | 'failed' | 'skipped'> {
    const claim = await claimSend(db, t.id, mailType, since ? `${kind}:${t.id}:${since}` : `${kind}:${t.id}`);
    if (claim === 'taken') return 'skipped';
    if (claim === 'error') return 'failed';
    const ok = await deliver(t);
    // Si falla, se libera la reserva (sin send_key) para que el próximo envío lo reintente.
    await db
      .from('email_log')
      .update(ok ? { status: 'sent', sent_at: new Date().toISOString() } : { status: 'failed', send_key: null })
      .eq('id', claim.id);
    return ok ? 'sent' : 'failed';
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let failsInRow = 0;
  let next = 0;
  const canContinue = () =>
    next < queue.length && failsInRow < MAX_FAILS_IN_ROW && Date.now() - startedAt < opts.budgetMs;

  async function worker() {
    while (canContinue()) {
      const outcome = await sendOne(queue[next++]);
      if (outcome === 'sent') {
        sent++;
        failsInRow = 0;
      } else if (outcome === 'failed') {
        failed++;
        failsInRow++;
      } else {
        skipped++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return { sent, failed, skipped, left: queue.length - sent - skipped };
}
