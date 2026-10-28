// ============================================================
// Mail de preventa a quienes vinieron antes. Ver docs/LOGICA_DE_NEGOCIO.md → "Tandas".
// ============================================================
// A quién: presale_audience (0014) — un email por persona con una entrada válida o usada de
// un evento anterior, sin quienes ya tienen entrada para este evento. Cada envío queda en
// presale_sends (uno por tanda y email): "Mandar" va solo a quien no lo recibió todavía.
import { entryTime, formatLocal, formatUYU } from '@/lib/events';
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
};

export function presaleEmail(d: PresaleMailData) {
  const subject = `Preventa para vos: ${d.eventTitle} · ${d.dateShort}`;
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
</td></tr></table></td></tr>`;

  const text = [
    `${d.firstName}, como ya viniste a una House Mates, te mandamos el link de la preventa de ${d.eventTitle} (${d.dateLong}).`,
    `${d.tierName}: ${formatUYU(d.price)}${d.entryUntil ? ` · ingreso hasta las ${d.entryUntil}` : ''}`,
    `Comprá en preventa: ${d.url}`,
    'La entrada es personal: una por persona, a tu nombre y con tu cédula.',
  ].join('\n');

  return { subject, html: layout(inner, `Preventa de ${d.eventTitle}: solo con este link.`), text };
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

export type PresaleResult = { sent: number; failed: number; left: number };

// Manda a los pendientes hasta terminar o hasta agotar `budgetMs`. Lo que queda sale en el
// próximo clic, sin repetir a nadie.
export async function sendPresaleMails(
  tierId: string,
  opts: { budgetMs: number; adminId: string },
): Promise<PresaleResult> {
  const startedAt = Date.now();
  const db = createAdminClient();
  const [{ data: tier, error }, audience] = await Promise.all([
    db
      .from('ticket_tiers')
      .select('id, name, price_uyu, entry_until, presale_code, events!inner(title, date_start, location_name)')
      .eq('id', tierId)
      .single(),
    presaleAudience(tierId),
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
  };
  const queue = audience.pending;

  async function sendOne(r: (typeof queue)[number]): Promise<boolean> {
    const mail = presaleEmail({ ...base, firstName: r.name.split(' ')[0] });
    const ok = await sendMail({ to: r.email, ...mail });
    await db.from('presale_sends').upsert(
      {
        tier_id: tierId,
        email_normalized: r.email_normalized,
        email: r.email,
        status: ok ? 'sent' : 'failed',
        sent_by_admin_id: opts.adminId,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'tier_id,email_normalized' },
    );
    return ok;
  }

  let sent = 0;
  let failed = 0;
  let failsInRow = 0;
  let next = 0;
  const canContinue = () =>
    next < queue.length && failsInRow < MAX_FAILS_IN_ROW && Date.now() - startedAt < opts.budgetMs;

  async function worker() {
    while (canContinue()) {
      const ok = await sendOne(queue[next++]);
      if (ok) {
        sent++;
        failsInRow = 0;
      } else {
        failed++;
        failsInRow++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return { sent, failed, left: queue.length - sent };
}
