// ============================================================
// Mail de preventa a quienes vinieron antes. Ver docs/LOGICA_DE_NEGOCIO.md → "Tandas".
// ============================================================
// A quién: presale_audience (0014) — un email por persona con una entrada válida o usada de
// un evento anterior, sin quienes ya tienen entrada para este evento. Cada envío queda en
// presale_sends (uno por tanda y email): "Mandar" va solo a quien no lo recibió todavía.
import { entryTime, formatLocal, formatUYU } from '@/lib/events';
import { DEFAULT_IG_HANDLE, getIgHandle, igUrl } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/tickets';
import { sendMail } from './send';
import { MAIL_COLORS as C, blend, button, esc, heading, layout, rows, solid } from './templates';

// Mismo criterio que los mails de comunicación (event-mails.ts): 4 en paralelo y se corta
// si fallan varios seguidos (p. ej. se llegó al límite diario de Gmail).
const CONCURRENCY = 4;
const MAX_FAILS_IN_ROW = 5;

export function presaleUrl(code: string): string {
  return `${appUrl()}/entradas?preventa=${encodeURIComponent(code)}`;
}

// ---------- Plantilla ----------

export type PresaleMailData = {
  firstName: string;
  eventTitle: string;
  dateLong: string; // "Viernes 11 de diciembre · 23:00 hs"
  dateShort: string; // "11.12.26"
  location: string | null;
  tierName: string;
  price: number;
  entryUntil: string | null; // "00:30"
  url: string;
  igHandle?: string;
};

// La preventa no es un mail de la compra: lleva al pie cómo darse de baja (ver /privacidad).
// Para sacar a alguien: su email en whitelist con status 'banned' (presale_audience lo excluye).
export function presaleEmail(d: PresaleMailData) {
  const subject = `Preventa para vos: ${d.eventTitle} · ${d.dateShort}`;
  const ig = d.igHandle ?? DEFAULT_IG_HANDLE;
  const details: [string, string][] = [
    ['Fecha', d.dateLong],
    ['Lugar', d.location ?? 'A confirmar'],
    ['Tanda', d.tierName],
    ...(d.entryUntil ? ([['Ingreso', `Hasta las ${d.entryUntil}`]] as [string, string][]) : []),
  ];

  const inner = `${heading(
    'PREVENTA',
    `${d.firstName}, la próxima es el ${d.dateShort}`,
    'Como ya viniste a una House Mates, te mandamos el link de la preventa. Solo se compra desde acá.',
  )}
<tr><td style="padding-top:28px;">${rows(details, ['Entrada', formatUYU(d.price)])}</td></tr>
${button(d.url, 'Comprar en preventa')}
<tr><td align="center" style="padding-top:10px;font-size:12px;color:${C.muted};">${blend('Si el botón no abre, copiá este link: ' + esc(d.url))}</td></tr>
<tr><td style="padding-top:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
${blend(`<strong style="color:${C.bone};">La entrada es personal</strong><br>Una por persona, a tu nombre y con tu cédula. En puerta te la pedimos.${
    d.entryUntil ? `<br>Esta tanda es de ingreso temprano: tenés que entrar antes de las ${esc(d.entryUntil)}.` : ''
  }`)}
</td></tr></table></td></tr>
<tr><td align="center" style="padding-top:24px;font-size:12px;line-height:1.6;color:${C.muted};">${blend(
    `Si no querés recibir más estos mails, respondé este mail o escribinos por <a href="${esc(igUrl(ig))}" style="color:${C.bone};">Instagram</a> y te sacamos.`,
  )}</td></tr>`;

  const text = [
    `${d.firstName}, como ya viniste a una House Mates, te mandamos el link de la preventa de ${d.eventTitle} (${d.dateLong}).`,
    `${d.tierName}: ${formatUYU(d.price)}${d.entryUntil ? ` · ingreso hasta las ${d.entryUntil}` : ''}`,
    `Comprá en preventa: ${d.url}`,
    'La entrada es personal: una por persona, a tu nombre y con tu cédula.',
    '',
    `Si no querés recibir más estos mails, respondé este mail o escribinos por Instagram (${igUrl(ig)}) y te sacamos.`,
  ].join('\n');

  return { subject, html: layout(inner, `Preventa de ${d.eventTitle}: solo con este link.`, ig), text };
}

// ---------- Destinatarios ----------

// PostgREST corta cada respuesta en 1000 filas (max_rows), también las de una RPC: se trae
// de a páginas (la RPC ordena por email, así que las páginas no se pisan).
const PAGE_SIZE = 1000;

export async function presaleAudience(tierId: string) {
  const db = createAdminClient();
  const all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .rpc('presale_audience', { p_tier_id: tierId })
      .range(from, from + PAGE_SIZE - 1);
    // Si la consulta falla, se corta: mejor no mandar nada que mandarle de nuevo a todos.
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  const pending = all.filter((r) => !r.already_sent);
  return { total: all.length, received: all.length - pending.length, pending };
}

// ---------- Envío ----------

// Por qué no se puede mandar la preventa de esta tanda (null = se puede). El mail dice
// "Comprar en preventa": si el link no deja comprar, no se manda.
export async function presaleBlocker(tierId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: tier, error } = await db
    .from('ticket_tiers')
    .select('event_id, active, sold_out_override, sales_start, presale_code, events!inner(status, sales_active, date_end)')
    .eq('id', tierId)
    .single();
  if (error || !tier) return 'No se encontró la tanda.';
  const event = tier.events as unknown as { status: string; sales_active: boolean; date_end: string };
  if (!tier.presale_code) return 'La tanda no es de preventa.';
  if (new Date(event.date_end).getTime() <= Date.now()) return 'El evento terminó.';
  if (event.status !== 'published') return 'El evento no está publicado: publicalo antes de mandar la preventa.';
  if (!event.sales_active) return 'Las ventas del evento están pausadas: activalas antes de mandar la preventa.';
  if (!tier.active) return 'La tanda está inactiva: activala antes de mandar la preventa.';
  if (tier.sold_out_override) return 'La tanda está agotada a mano: restaurala antes de mandar la preventa.';
  if (tier.sales_start && new Date(tier.sales_start).getTime() > Date.now()) {
    return `La tanda sale a la venta el ${formatLocal(tier.sales_start, "d/MM 'a las' HH:mm")}: mandá la preventa desde ese momento.`;
  }
  const [{ data: tierLeft }, { data: eventLeft }] = await Promise.all([
    db.rpc('tier_available', { p_tier_id: tierId }),
    db.rpc('event_available', { p_event_id: tier.event_id }),
  ]);
  if ((tierLeft ?? 0) <= 0) return 'La tanda no tiene lugares disponibles.';
  if ((eventLeft ?? 0) <= 0) return 'El evento llegó a su capacidad.';
  return null;
}

// Antes de mandar, cada email se reserva en presale_sends (única por tanda y email): la fila
// pasa a 'sending' solo si no existía, si falló antes o si quedó colgada de un envío que se
// cortó. Si otro envío la tiene (dos owners o un doble clic a la vez), ese mail no sale.
const STALE_CLAIM_MS = 10 * 60_000;

async function claimPresaleSend(
  db: ReturnType<typeof createAdminClient>,
  row: { tier_id: string; email_normalized: string; email: string; sent_by_admin_id: string },
): Promise<'claimed' | 'taken' | 'error'> {
  const claim = { ...row, status: 'sending' as const, sent_at: new Date().toISOString() };
  const inserted = await db
    .from('presale_sends')
    .upsert(claim, { onConflict: 'tier_id,email_normalized', ignoreDuplicates: true })
    .select('id');
  if (inserted.error) return 'error';
  if (inserted.data.length > 0) return 'claimed';
  const retry = await db
    .from('presale_sends')
    .update(claim)
    .eq('tier_id', row.tier_id)
    .eq('email_normalized', row.email_normalized)
    .eq('status', 'failed')
    .select('id');
  if (retry.error) return 'error';
  if (retry.data.length > 0) return 'claimed';
  const stale = await db
    .from('presale_sends')
    .update(claim)
    .eq('tier_id', row.tier_id)
    .eq('email_normalized', row.email_normalized)
    .eq('status', 'sending')
    .lt('sent_at', new Date(Date.now() - STALE_CLAIM_MS).toISOString())
    .select('id');
  if (stale.error) return 'error';
  return stale.data.length > 0 ? 'claimed' : 'taken';
}

// skipped: los tenía otro envío que corría a la vez (no se cuentan como pendientes).
export type PresaleResult = { sent: number; failed: number; skipped: number; left: number };

// Manda a los pendientes hasta terminar o hasta agotar `budgetMs`. Lo que queda sale en el
// próximo clic, sin repetir a nadie.
export async function sendPresaleMails(
  tierId: string,
  opts: { budgetMs: number; adminId: string },
): Promise<PresaleResult> {
  const startedAt = Date.now();
  const db = createAdminClient();
  const [{ data: tier, error }, audience, igHandle] = await Promise.all([
    db
      .from('ticket_tiers')
      .select('id, name, price_uyu, entry_until, presale_code, events!inner(title, date_start, location_name)')
      .eq('id', tierId)
      .single(),
    presaleAudience(tierId),
    getIgHandle(),
  ]);
  if (error || !tier?.presale_code) throw error ?? new Error('La tanda no es de preventa');
  const event = tier.events as unknown as { title: string; date_start: string; location_name: string | null };

  const base = {
    eventTitle: event.title,
    dateLong: formatLocal(event.date_start, "EEEE d 'de' MMMM · HH:mm 'hs'").replace(/^./, (c) => c.toUpperCase()),
    dateShort: formatLocal(event.date_start, 'dd.MM.yy'),
    location: event.location_name || null,
    tierName: tier.name,
    price: Number(tier.price_uyu),
    entryUntil: entryTime(tier.entry_until),
    url: presaleUrl(tier.presale_code),
    igHandle,
  };
  const queue = audience.pending;

  async function sendOne(r: (typeof queue)[number]): Promise<'sent' | 'failed' | 'skipped'> {
    const claim = await claimPresaleSend(db, {
      tier_id: tierId,
      email_normalized: r.email_normalized,
      email: r.email,
      sent_by_admin_id: opts.adminId,
    });
    if (claim === 'taken') return 'skipped';
    if (claim === 'error') return 'failed';
    const mail = presaleEmail({ ...base, firstName: r.name.split(' ')[0] });
    const ok = await sendMail({ to: r.email, ...mail });
    await db
      .from('presale_sends')
      .update({ status: ok ? 'sent' : 'failed', sent_at: new Date().toISOString() })
      .eq('tier_id', tierId)
      .eq('email_normalized', r.email_normalized);
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
