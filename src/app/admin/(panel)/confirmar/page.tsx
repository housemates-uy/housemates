import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { getAdminUser } from '@/lib/auth/admin';
import { InstagramLink } from '@/components/admin/instagram-link';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/card';
import { formatLocal, formatUYU } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, STATUS_LABELS } from '@/lib/tickets';
import { getTransportByTicket } from '@/lib/transport';
import { cn } from '@/lib/utils';
import { TransferReview } from './transfer-review';

export const metadata = { title: 'Entradas a confirmar' };

// Entradas a confirmar: las transferencias con comprobante de todos los eventos, una tarjeta
// por compra (la entrada de quien compró y las de sus amigos se pagan con una sola
// transferencia), la más vieja primero. Solo owners (el staff no ve plata ni comprobantes).
// Ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
// n: cuántas entradas resolvió la acción (viaja en la URL).
const OUTCOMES: Record<string, { ok: boolean; text: (name: string, n: number) => string }> = {
  aceptada: {
    ok: true,
    text: (name, n) =>
      n > 1
        ? `Aceptaste la compra de ${name}: ${n} entradas. A cada uno le mandamos su entrada con el QR a su mail.`
        : `Aceptaste la entrada de ${name}. Le mandamos el mail con la entrada y el QR.`,
  },
  'aceptada-sin-mail': {
    ok: false,
    text: (name, n) =>
      n > 1
        ? `Aceptaste la compra de ${name}: ${n} entradas, pero no se pudo mandar alguno de los mails. Reenvialos desde Entradas del evento.`
        : `Aceptaste la entrada de ${name}, pero no se pudo mandar el mail. Reenviáselo desde Entradas del evento.`,
  },
  declinada: {
    ok: true,
    text: (name, n) =>
      n > 1
        ? `Declinaste la compra de ${name}: ${n} entradas. Se liberaron los lugares y le avisamos por mail a quien compró.`
        : `Declinaste la transferencia de ${name}. Se liberó el lugar y le avisamos por mail.`,
  },
  'declinada-sin-mail': {
    ok: false,
    text: (name, n) =>
      n > 1
        ? `Declinaste la compra de ${name}: ${n} entradas. Se liberaron los lugares, pero no se pudo mandar el mail: avisale por Instagram.`
        : `Declinaste la transferencia de ${name} y se liberó el lugar, pero no se pudo mandar el mail: avisale por Instagram.`,
  },
  'ya-resuelta': {
    ok: false,
    text: (name) => `La transferencia de ${name} ya estaba resuelta: no se cambió nada.`,
  },
  'sin-comprobante': {
    ok: false,
    text: (name) => `La transferencia de ${name} no tiene comprobante: no se puede aceptar.`,
  },
  error: { ok: false, text: () => 'No se pudo completar. Probá de nuevo.' },
};

export default async function ConfirmTransfersPage({
  searchParams,
}: {
  searchParams: { evento?: string; hecho?: string; entrada?: string; n?: string };
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');
  if (admin.role !== 'owner') redirect('/admin');

  const db = createAdminClient();
  const hecho = searchParams.hecho;
  const outcome = hecho && Object.hasOwn(OUTCOMES, hecho) ? OUTCOMES[hecho] : undefined;
  const outcomeCount = Math.max(1, Math.floor(Number(searchParams.n)) || 1);
  const [{ data: rows }, { data: resolved }] = await Promise.all([
    db
      .from('tickets')
      .select(
        'id, order_id, event_id, buyer_name, buyer_email, buyer_document, buyer_phone, buyer_instagram, amount_paid_uyu, discount_uyu, discount_code_id, receipt_path, created_at, events(title), ticket_tiers(name)',
      )
      .eq('status', 'review')
      .order('created_at', { ascending: true }),
    outcome && searchParams.entrada
      ? db
          .from('tickets')
          .select('buyer_name, status, event_id')
          .eq('id', searchParams.entrada)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Una compra = la entrada de quien compró y las de sus amigos (order_id); una entrada sin
  // grupo es una compra de una. Quien compró va primero y después los demás por nombre (se
  // crean en la misma transacción: created_at no dice el orden).
  type ReviewTicket = NonNullable<typeof rows>[number];
  const byOrder = new Map<string, ReviewTicket[]>();
  for (const t of rows ?? []) {
    const key = t.order_id ?? t.id;
    byOrder.set(key, [...(byOrder.get(key) ?? []), t]);
  }
  const all = Array.from(byOrder, ([leadId, tickets]) => {
    const people = [...tickets].sort((a, b) =>
      a.id === leadId ? -1 : b.id === leadId ? 1 : a.buyer_name.localeCompare(b.buyer_name, 'es'),
    );
    return { lead: people[0], people };
  });

  const events = new Map<string, { title: string; count: number }>();
  for (const { lead } of all) {
    const e = events.get(lead.event_id) ?? { title: lead.events?.title ?? 'Evento', count: 0 };
    events.set(lead.event_id, { ...e, count: e.count + 1 });
  }
  // Si ese evento ya no tiene pendientes (se resolvió la última), se muestran todas.
  const eventFilter =
    searchParams.evento && events.has(searchParams.evento) ? searchParams.evento : null;
  const listed = eventFilter ? all.filter((o) => o.lead.event_id === eventFilter) : all;
  const listedTickets = listed.reduce((sum, o) => sum + o.people.length, 0);

  const codeIds = Array.from(
    new Set(listed.map((o) => o.lead.discount_code_id).filter((id): id is string => !!id)),
  );
  const [busMaps, { data: codes }] = await Promise.all([
    Promise.all(
      Array.from(new Set(listed.map((o) => o.lead.event_id))).map((eventId) =>
        getTransportByTicket({ eventId }),
      ),
    ),
    codeIds.length > 0
      ? db.from('discount_codes').select('id, code').in('id', codeIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
  ]);
  const buses = new Map(busMaps.flatMap((m) => Array.from(m)));
  const codeName = new Map((codes ?? []).map((c) => [c.id, c.code]));
  const clearHref = eventFilter ? `/admin/confirmar?evento=${eventFilter}` : '/admin/confirmar';

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Entradas a confirmar"
        description="Transferencias con comprobante, una tarjeta por compra. Fijate que la plata haya llegado a la cuenta antes de aceptar: al aceptar, a cada persona le llega su entrada con el QR a su mail; al declinar se liberan los lugares y le avisamos por mail a quien compró."
      />

      {/* Pegado abajo del header: después de aceptar o declinar la página no vuelve arriba, y
          en el celular el aviso quedaría fuera de la pantalla. */}
      {outcome && (
        <div
          role="status"
          className={cn(
            'sticky top-[4.5rem] z-10 flex items-start gap-3 rounded-card border bg-ink/95 px-4 py-3.5 text-sm text-bone shadow-lg shadow-ink/60 backdrop-blur',
            outcome.ok ? 'border-bone/20' : 'border-alert/40',
          )}
        >
          {outcome.ok ? (
            <CircleCheck size={18} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />
          ) : (
            <CircleAlert
              size={18}
              strokeWidth={1.5}
              className="mt-px shrink-0 text-alert"
              aria-hidden
            />
          )}
          <p className="min-w-0 flex-1">
            {outcome.text(resolved?.buyer_name ?? 'esa persona', outcomeCount)}
            {searchParams.hecho === 'ya-resuelta' &&
              resolved &&
              ` Estado: ${STATUS_LABELS[resolved.status]}.`}
            {searchParams.hecho === 'aceptada-sin-mail' && resolved && (
              <>
                {' '}
                <Link
                  href={`/admin/events/${resolved.event_id}/tickets`}
                  className="underline underline-offset-4"
                >
                  Ir a Entradas
                </Link>
              </>
            )}
          </p>
          <Link
            href={clearHref}
            aria-label="Cerrar aviso"
            className="-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-bone/50 hover:bg-bone/5 hover:text-bone"
          >
            <X size={16} strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      )}

      {events.size > 1 && (
        <nav
          aria-label="Filtrar por evento"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
        >
          <FilterChip
            href="/admin/confirmar"
            active={!eventFilter}
            label={`Todos · ${all.length}`}
          />
          {Array.from(events).map(([id, e]) => (
            <FilterChip
              key={id}
              href={`/admin/confirmar?evento=${id}`}
              active={eventFilter === id}
              label={`${e.title} · ${e.count}`}
            />
          ))}
        </nav>
      )}

      {listed.length === 0 ? (
        <EmptyState title="No hay transferencias para confirmar">
          Cuando alguien pague por transferencia y suba el comprobante, aparece acá. También les
          llega un mail a los owners.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-bone/55">
            {listed.length === 1 ? '1 compra esperando' : `${listed.length} compras esperando`}
            {listedTickets > listed.length && ` (${listedTickets} entradas)`} · la más vieja
            primero
          </p>
          <ul className="grid items-start gap-4 lg:grid-cols-2">
            {listed.map(({ lead, people }) => {
              const isGroup = people.length > 1;
              const tierLabel = lead.ticket_tiers?.name ?? 'Entrada';
              const total = people.reduce((sum, t) => sum + Number(t.amount_paid_uyu), 0);
              const discount = people.reduce((sum, t) => sum + Number(t.discount_uyu), 0);
              const withBus = people.flatMap((t) => buses.get(t.id) ?? []);
              const busTotal = withBus.reduce((sum, b) => sum + b.price, 0);
              // Transferencia: total = (precio − descuento) + transporte, sin cargo por servicio.
              const entryPrice = total - busTotal + discount;
              const code = lead.discount_code_id ? codeName.get(lead.discount_code_id) : null;
              const receipt = !lead.receipt_path
                ? null
                : lead.receipt_path.endsWith('.pdf')
                  ? 'pdf'
                  : 'image';
              return (
                <li
                  key={lead.id}
                  className="space-y-4 rounded-card border border-bone/10 bg-bone/[0.03] p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bone/45">
                        {lead.events?.title ?? 'Evento'} · {tierLabel}
                        {isGroup && ` · ${people.length} entradas`}
                      </p>
                      <h2 className="mt-1.5 text-lg font-bold leading-snug tracking-tight">
                        {lead.buyer_name}
                      </h2>
                    </div>
                    <p className="shrink-0 pt-0.5 text-xs text-bone/50">
                      {formatDistanceToNowStrict(new Date(lead.created_at), {
                        locale: es,
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-bone/45">CI</dt>
                    <dd className="tabular-nums">{formatDocument(lead.buyer_document)}</dd>
                    <dt className="text-bone/45">Email</dt>
                    <dd className="break-words">{lead.buyer_email}</dd>
                    {lead.buyer_phone && (
                      <>
                        <dt className="text-bone/45">Celular</dt>
                        <dd className="tabular-nums">{lead.buyer_phone}</dd>
                      </>
                    )}
                    {lead.buyer_instagram && (
                      <>
                        <dt className="text-bone/45">Instagram</dt>
                        <dd className="break-words">
                          <InstagramLink handle={lead.buyer_instagram} />
                        </dd>
                      </>
                    )}
                    <dt className="text-bone/45">Enviado</dt>
                    <dd>{formatLocal(lead.created_at, "EEE d/MM 'a las' HH:mm 'hs'")}</dd>
                  </dl>

                  {isGroup && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bone/45">
                        Entradas de la compra
                      </p>
                      <ol className="mt-2 divide-y divide-bone/10 rounded-control border border-bone/10">
                        {people.map((t) => {
                          const bus = buses.get(t.id);
                          return (
                            <li key={t.id} className="px-3.5 py-2.5">
                              <p className="text-sm font-medium">
                                {t.buyer_name}
                                {t.id === lead.id && (
                                  <span className="font-normal text-bone/45"> · compra</span>
                                )}
                              </p>
                              <p className="mt-0.5 break-words text-xs text-bone/55">
                                <span className="tabular-nums">
                                  CI {formatDocument(t.buyer_document)}
                                </span>
                                {' · '}
                                {t.buyer_email}
                                {t.buyer_instagram && (
                                  <>
                                    {' · '}
                                    <InstagramLink handle={t.buyer_instagram} />
                                  </>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-bone/45">
                                {bus ? `Transporte · ${bus.name}` : 'Sin transporte'}
                              </p>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}

                  <dl className="space-y-1.5 rounded-control border border-bone/10 px-4 py-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-bone/60">
                        {isGroup ? `${people.length} entradas` : 'Entrada'} · {tierLabel}
                      </dt>
                      <dd className="tabular-nums">{formatUYU(entryPrice)}</dd>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-bone/60">Descuento{code && ` (${code})`}</dt>
                        <dd className="tabular-nums">−{formatUYU(discount)}</dd>
                      </div>
                    )}
                    {withBus.length > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-bone/60">
                          Transporte ·{' '}
                          {isGroup
                            ? `${withBus.length} ${withBus.length === 1 ? 'lugar' : 'lugares'}`
                            : withBus[0].name}
                        </dt>
                        <dd className="tabular-nums">{formatUYU(busTotal)}</dd>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-4 border-t border-bone/10 pt-2">
                      <dt className="font-medium">Total a transferir</dt>
                      <dd className="text-xl font-bold tabular-nums tracking-tight">
                        {formatUYU(total)}
                      </dd>
                    </div>
                  </dl>

                  <TransferReview
                    ticketId={lead.id}
                    buyerName={lead.buyer_name}
                    count={people.length}
                    totalLabel={formatUYU(total)}
                    receipt={receipt}
                    eventFilter={eventFilter}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-chip border px-3 text-[13px] transition-colors',
        active
          ? 'border-bone bg-bone font-medium text-ink'
          : 'border-bone/15 text-bone/70 hover:border-bone/40 hover:text-bone',
      )}
    >
      {label}
    </Link>
  );
}
