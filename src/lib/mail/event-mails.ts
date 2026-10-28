// ============================================================
// Comunicación con quienes tienen entrada de un evento.
// Ver docs/LOGICA_DE_NEGOCIO.md → "Comunicación".
// ============================================================
// - Recordatorio "Antes de ir": a las entradas válidas (`paid`), con el QR embebido.
// - Encuesta del día después: a quienes entraron (`used`), con link a /encuesta/<token>.
// Cada envío queda en email_log; quien ya tiene un envío `sent` de ese tipo no se repite
// (salvo "reenviar a todos", que usa `since` para no contar los envíos anteriores).
// Antes de mandar, cada entrada se reserva en email_log (send_key único, 0019): si dos
// envíos corren a la vez (dos owners, un doble clic o el cron), cada mail sale una sola vez.
// Lo usan el admin (resumen del evento) y el cron diario (/api/cron/comunicacion).
import QRCode from 'qrcode';
import { entryTime, formatLocal } from '@/lib/events';
import { mapsUrl } from '@/lib/next-event';
import { getIgHandle } from '@/lib/site';
import { createAdminClient, fetchAll } from '@/lib/supabase/admin';
import { appUrl, ticketUrl } from '@/lib/tickets';
import type { EmailType, TicketStatus } from '@/types/database';
import { sendMail } from './send';
import { MAIL_COLORS as C, blend, button, ciMasked, esc, heading, layout, rows, solid } from './templates';

export type CommsKind = 'reminder' | 'survey';

const KINDS: Record<CommsKind, { status: TicketStatus; mailType: EmailType }> = {
  reminder: { status: 'paid', mailType: 'reminder' },
  survey: { status: 'used', mailType: 'survey' },
};

// Las mismas reglas que muestra la landing (src/components/landing/rules.tsx).
const RULES = [
  'El ingreso es por lista.',
  'Al llegar presentá tu CI y se te coloca un precinto.',
  'No se venden entradas en puerta.',
  'Hay ropería: el ticket se compra en barra.',
];

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

const panel = (html: string) =>
  `<tr><td style="padding-top:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">${blend(html)}</td></tr></table></td></tr>`;

const panelTitle = (s: string) => `<strong style="color:${C.bone};font-size:14px;">${esc(s)}</strong>`;

// ---------- Plantillas ----------

export type ReminderMailData = {
  firstName: string;
  fullName: string;
  docTail: string;
  eventTitle: string;
  dateLong: string; // "Viernes 11 de diciembre · 23:00 hs"
  dateShort: string; // "11.12.26"
  entryLabel: string;
  location: string;
  locationUrl: string;
  arrivalInfo: string | null;
  ticketUrl: string;
  igHandle?: string;
};

export function reminderEmail(d: ReminderMailData) {
  const subject = `Antes de ir: ${d.eventTitle} · ${d.dateShort}`;
  const arrival = d.arrivalInfo ? esc(d.arrivalInfo).replace(/\r?\n/g, '<br>') : null;
  const rules = RULES.map(
    (r, i) =>
      `<tr><td valign="top" style="width:28px;padding:4px 0;font-size:12px;font-weight:700;color:${C.muted};">${blend(String(i + 1).padStart(2, '0'))}</td><td style="padding:4px 0;font-size:14px;line-height:1.5;color:${C.bone};">${blend(esc(r))}</td></tr>`,
  ).join('');

  const inner = `${heading(
    'ANTES DE IR',
    `${d.firstName}, te esperamos`,
    'Acá tenés todo para llegar sin vueltas: dónde es, qué llevar y tu QR.',
  )}
<tr><td style="padding-top:28px;">${rows([
    ['Fecha', d.dateLong],
    ['Lugar', d.location],
    ['Entrada', d.entryLabel],
  ])}</td></tr>
${button(d.locationUrl, 'Abrir en Google Maps')}
${arrival ? panel(`${panelTitle('Cómo llegar')}<br>${arrival}`) : ''}
${panel(
  `${panelTitle('Qué llevar')}<br>Tu cédula física: sin cédula no se entra, aunque tengas el QR.<br>Tu QR, en el celular o impreso. Lo tenés acá abajo.`,
)}
<tr><td style="padding-top:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.ink)}border:1px solid ${C.line};border-radius:18px;">
<tr><td style="padding:20px 24px 0;font-size:13px;color:${C.soft};">${blend(`${esc(d.eventTitle)} · ${esc(d.entryLabel)}`)}</td>
<td align="right" style="padding:20px 24px 0;font-size:11px;font-weight:700;letter-spacing:2px;">${blend('VÁLIDA')}</td></tr>
<tr><td colspan="2" align="center" style="padding:18px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;"><tr><td style="padding:10px;">
<img src="cid:qr" width="200" height="200" alt="Código QR de la entrada" style="display:block;border:0;">
</td></tr></table>
</td></tr>
<tr><td colspan="2" align="center" style="padding:0 24px 22px;font-size:20px;font-weight:700;">${blend(`${esc(d.fullName)}<br>
<span style="font-size:13px;font-weight:400;color:${C.soft};">${esc(ciMasked(d.docTail))}</span>`)}</td></tr>
</table>
</td></tr>
${button(d.ticketUrl, 'Ver mi entrada')}
<tr><td style="padding-top:32px;font-size:16px;font-weight:700;color:${C.bone};">${blend('Cuidemos la casa')}</td></tr>
<tr><td style="padding-top:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rules}</table></td></tr>`;

  const text = [
    `${d.firstName}, te esperamos en ${d.eventTitle}.`,
    `Fecha: ${d.dateLong}`,
    `Lugar: ${d.location} (${d.locationUrl})`,
    d.arrivalInfo ? `Cómo llegar: ${d.arrivalInfo}` : '',
    'Qué llevar: tu cédula física (sin cédula no se entra) y tu QR, en el celular o impreso.',
    `Tu entrada con el QR: ${d.ticketUrl}`,
    `Cuidemos la casa: ${RULES.join(' ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html: layout(inner, 'Fecha, lugar, qué llevar y tu QR.', d.igHandle), text };
}

export type SurveyMailData = { firstName: string; eventTitle: string; surveyUrl: string; igHandle?: string };

export function surveyEmail(d: SurveyMailData) {
  const subject = `¿Qué tal estuvo ${d.eventTitle}?`;
  // Cada número abre la encuesta con ese puntaje ya elegido (no guarda nada: falta enviar).
  const scale = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<td width="20%" style="padding:0 4px;"><a href="${d.surveyUrl}?puntaje=${n}" style="display:block;${solid(C.ink)}border:1px solid ${C.bone};border-radius:10px;padding:14px 0;text-align:center;text-decoration:none;font-size:22px;font-weight:700;color:${C.bone};font-family:inherit;">${blend(String(n))}</a></td>`,
    )
    .join('');

  const inner = `${heading(
    'GRACIAS POR VENIR',
    `${d.firstName}, ¿qué tal estuvo?`,
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
  const [{ data: event, error }, { data: tiers }, audience, igHandle] = await Promise.all([
    db
      .from('events')
      .select('id, title, date_start, location_name, location_url, arrival_info')
      .eq('id', eventId)
      .single(),
    db.from('ticket_tiers').select('id, name, entry_until').eq('event_id', eventId),
    commsAudience(eventId, kind, since),
    getIgHandle(),
  ]);
  if (error || !event) throw error ?? new Error('Evento no encontrado');

  // Las tandas de ingreso temprano llevan el horario: es lo que más importa recordar el día antes.
  const tierName = new Map(
    (tiers ?? []).map((t) => [t.id, t.entry_until ? `${t.name} · ingreso hasta ${entryTime(t.entry_until)}` : t.name]),
  );
  const dateLong = formatLocal(event.date_start, "EEEE d 'de' MMMM · HH:mm 'hs'").replace(/^./, (c) => c.toUpperCase());
  const dateShort = formatLocal(event.date_start, 'dd.MM.yy');
  const { mailType } = KINDS[kind];
  const queue = audience.pending;

  async function deliver(t: Recipient): Promise<boolean> {
    const token = t.qr_token!;
    const firstName = t.buyer_name.split(' ')[0];
    if (kind === 'survey') {
      const mail = surveyEmail({ firstName, eventTitle: event!.title, surveyUrl: surveyUrl(token), igHandle });
      return sendMail({ to: t.buyer_email, ...mail });
    }
    const url = ticketUrl(token);
    const mail = reminderEmail({
      firstName,
      fullName: t.buyer_name,
      docTail: t.buyer_document.slice(-4),
      eventTitle: event!.title,
      dateLong,
      dateShort,
      entryLabel: t.source === 'invitation' ? 'Invitación' : ((t.tier_id && tierName.get(t.tier_id)) || 'Entrada'),
      location: event!.location_name,
      locationUrl: mapsUrl(event!.location_name, event!.location_url),
      arrivalInfo: event!.arrival_info,
      ticketUrl: url,
      igHandle,
    });
    const qr = await QRCode.toBuffer(url, { width: 400, margin: 1, errorCorrectionLevel: 'M' });
    return sendMail({
      to: t.buyer_email,
      ...mail,
      attachments: [{ filename: 'entrada-qr.png', content: qr, cid: 'qr' }],
    });
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
