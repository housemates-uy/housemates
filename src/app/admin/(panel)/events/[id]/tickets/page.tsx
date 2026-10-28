import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient, fetchAll } from '@/lib/supabase/admin';
import { ConfirmSubmitButton, SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, StatCard } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatLocal, formatUYU } from '@/lib/events';
import { formatDocument, normalizeDocument, SOURCE_LABELS, STATUS_LABELS, ticketUrl } from '@/lib/tickets';
import { getTransportByTicket } from '@/lib/transport';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/database';
import { approveTransferAction, cancelTicketAction, rejectTransferAction, resendTicketMailAction } from './actions';
import { CancelTicketButton } from './cancel-ticket-button';
import { CopyLinkButton } from './copy-link-button';
import { NewTicketForm } from './new-ticket-form';

// Entradas de un evento: alta manual / invitación, listado con búsqueda y anulación.
// Las compras web pendientes (todavía pagando) también aparecen, con su estado.
// Arriba de todo, las transferencias con comprobante que falta validar (solo owners).
// Como en Ventas, la plata (recaudado, montos) y los comprobantes los ven solo los owners.
// PostgREST corta cada respuesta en 1000 filas: la búsqueda se hace en la base, la lista va
// de a páginas y los totales se cuentan en la base (count) o se traen enteros (fetchAll).
const STATUS_TONE: Record<TicketStatus, 'solid' | 'neutral' | 'alert' | 'club'> = {
  paid: 'solid',
  used: 'club',
  pending: 'neutral',
  review: 'alert',
  cancelled: 'neutral',
  refunded: 'neutral',
};

const PAGE_SIZE = 100;

// Resultado de Anular / Reembolsar (llega por la URL desde cancelTicketAction).
const CANCEL_OUTCOMES: Record<string, { ok: boolean; text: string }> = {
  anulada: { ok: true, text: 'Anulada. Le avisamos por mail.' },
  'anulada-sin-mail': { ok: false, text: 'Anulada, pero no se pudo mandar el mail: avisale por Instagram.' },
  reembolsada: { ok: true, text: 'Reembolsada: se devolvió la plata por Mercado Pago y le avisamos por mail.' },
  'reembolsada-sin-mail': {
    ok: false,
    text: 'Reembolsada: se devolvió la plata por Mercado Pago, pero no se pudo mandar el mail: avisale por Instagram.',
  },
  'ya-devuelta': {
    ok: true,
    text: 'En Mercado Pago el pago ya figuraba devuelto: no se devolvió de nuevo. La entrada quedó reembolsada y le avisamos por mail.',
  },
  'devuelta-usada': {
    ok: false,
    text: 'En Mercado Pago el pago figura devuelto, pero la entrada se usó en puerta: quedó como usada.',
  },
  'devuelta-revisar': {
    ok: false,
    text: 'En Mercado Pago el pago ya figuraba devuelto: no se devolvió de nuevo. Revisá cómo quedó la entrada.',
  },
  'devuelta-sin-anular': {
    ok: false,
    text: 'Se devolvió la plata por Mercado Pago, pero no se pudo anular la entrada. Recargá en un rato: cuando Mercado Pago avisa la devolución, se anula sola. Si sigue válida, avisá.',
  },
};

const LIST_COLUMNS =
  'id, buyer_name, buyer_email, buyer_document, buyer_instagram, status, source, tier_id, amount_paid_uyu, qr_token, payment_method, mp_payment_id, notes';
const REVIEW_COLUMNS =
  'id, buyer_name, buyer_email, buyer_document, buyer_instagram, tier_id, amount_paid_uyu, discount_uyu, receipt_path, created_at';

// La búsqueda va dentro de un filtro `or` de PostgREST: se sacan los caracteres que lo rompen
// (coma, paréntesis, comillas, comodines) y cada valor va entre comillas.
function searchFilter(q: string): string | null {
  const term = q.replace(/[^\p{L}\p{N}@._+\- ]/gu, '').trim();
  const instagram = term.replace(/^@+/, '').toLowerCase();
  // Por cédula solo si lo que se escribió parece una (dígitos, puntos y guiones): "Juan 2" no
  // tiene que traer todas las cédulas con un 2.
  const doc = /^[\d.\-\s]+$/.test(q) && /\d/.test(q) ? normalizeDocument(q).replace(/^0+/, '') : '';
  const filters = [
    ...(term ? [`buyer_name.ilike."%${term}%"`, `buyer_email.ilike."%${term}%"`] : []),
    ...(instagram ? [`buyer_instagram.ilike."%${instagram}%"`] : []),
    ...(doc ? [`buyer_document.like."%${doc}%"`] : []),
  ];
  return filters.length > 0 ? filters.join(',') : null;
}

export default async function EventTicketsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string; pagina?: string; hecho?: string; entrada?: string };
}) {
  const admin = await requireAdmin();
  const isOwner = admin.role === 'owner';
  const db = createAdminClient();
  const eventId = params.id;
  const q = searchParams.q?.trim() ?? '';
  const page = Math.max(1, Math.floor(Number(searchParams.pagina)) || 1);
  const now = new Date().toISOString();
  const filter = q ? searchFilter(q) : null;
  const view = { q, pagina: page };
  const outcome =
    searchParams.hecho && Object.hasOwn(CANCEL_OUTCOMES, searchParams.hecho) ? CANCEL_OUTCOMES[searchParams.hecho] : null;

  const countTickets = () =>
    db.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId);

  // Lista: sin las transferencias a validar (van arriba) ni las compras pendientes con la
  // reserva vencida (pagos abandonados).
  let listQuery = db
    .from('tickets')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('event_id', eventId)
    .neq('status', 'review')
    .or(`status.neq.pending,reserved_until.gt."${now}"`);
  if (q) listQuery = filter ? listQuery.or(filter) : listQuery.eq('id', '00000000-0000-0000-0000-000000000000');

  const [{ data: tiers }, valid, used, paying, toReview, amounts, list, { data: outcomeTicket }] = await Promise.all([
    db
      .from('ticket_tiers')
      .select('id, name, price_uyu, active, quantity_total, quantity_sold')
      .eq('event_id', eventId)
      .order('sort_order'),
    countTickets().in('status', ['paid', 'used']),
    countTickets().eq('status', 'used'),
    countTickets().eq('status', 'pending').gt('reserved_until', now),
    // Transferencias a validar, de la más vieja a la más nueva.
    fetchAll((from, to) =>
      db
        .from('tickets')
        .select(REVIEW_COLUMNS)
        .eq('event_id', eventId)
        .eq('status', 'review')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    ),
    isOwner
      ? fetchAll((from, to) =>
          db
            .from('tickets')
            .select('amount_paid_uyu')
            .eq('event_id', eventId)
            .in('status', ['paid', 'used'])
            .order('id')
            .range(from, to),
        )
      : Promise.resolve([]),
    listQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    outcome && searchParams.entrada
      ? db.from('tickets').select('buyer_name').eq('id', searchParams.entrada).eq('event_id', eventId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  for (const r of [valid, used, paying]) if (r.error) throw r.error;
  // Una página que ya no existe (p. ej. se anularon entradas): vuelve a la primera.
  if (list.error?.code === 'PGRST103') redirect(`/admin/events/${eventId}/tickets${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  if (list.error) throw list.error;

  const listed = list.data;
  const listedTotal = list.count ?? listed.length;
  const pages = Math.max(1, Math.ceil(listedTotal / PAGE_SIZE));
  const buses = await getTransportByTicket({ ticketIds: [...listed, ...toReview].map((t) => t.id) });

  // Disponibilidad real (descuenta reservas de compras web en curso).
  const tierOptions = await Promise.all(
    (tiers ?? [])
      .filter((t) => t.active)
      .map(async (t) => {
        const { data } = await db.rpc('tier_available', { p_tier_id: t.id });
        return { id: t.id, name: t.name, price: Number(t.price_uyu), available: (data as number) ?? 0 };
      }),
  );
  const tierName = new Map((tiers ?? []).map((t) => [t.id, t.name]));
  const revenue = amounts.reduce((sum, t) => sum + Number(t.amount_paid_uyu), 0);

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (n > 1) p.set('pagina', String(n));
    const qs = p.toString();
    return `/admin/events/${eventId}/tickets${qs ? `?${qs}` : ''}#lista`;
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div className={cn('grid grid-cols-2 gap-4', isOwner ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <StatCard label="Entradas válidas" value={valid.count ?? 0} sub="Pagas + ya usadas" />
        <StatCard label="Ya entraron" value={used.count ?? 0} />
        {isOwner && (
          <StatCard label="Recaudado" value={<span className="text-2xl">{formatUYU(revenue)}</span>} />
        )}
        <StatCard
          label="Pagando ahora"
          value={paying.count ?? 0}
          sub="Reservas web en curso"
        />
        <StatCard label="A validar" value={toReview.length} sub="Transferencias" />
      </div>

      {toReview.length > 0 && (
        <section id="a-validar" className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Transferencias a validar ({toReview.length})</h2>
            <p className="mt-1 text-sm text-bone/55">
              Fijate que la plata haya llegado a la cuenta antes de aprobar. Al aprobar le llega la
              entrada por mail; al rechazar, se libera el lugar y le avisamos.
            </p>
          </div>
          <ul className="divide-y divide-bone/10 rounded-card border border-alert/30">
            {toReview.map((t) => {
              const approve = approveTransferAction.bind(null, t.id);
              const reject = rejectTransferAction.bind(null, t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t.buyer_name}
                      {isOwner && (
                        <>
                          {' · '}
                          <span className="font-bold">{formatUYU(Number(t.amount_paid_uyu))}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-bone/55">
                      CI {formatDocument(t.buyer_document)} · {t.buyer_email}
                      {t.buyer_instagram && ` · @${t.buyer_instagram}`}
                    </p>
                    <p className="mt-0.5 text-xs text-bone/45">
                      {t.tier_id && tierName.get(t.tier_id)}
                      {isOwner && Number(t.discount_uyu) > 0 && ` · descuento ${formatUYU(Number(t.discount_uyu))}`}
                      {buses.has(t.id) &&
                        ` · Bus: ${buses.get(t.id)?.name}${isOwner ? ` ${formatUYU(buses.get(t.id)?.price ?? 0)}` : ''}`}
                      {` · subido ${formatLocal(t.created_at, "d/MM 'a las' HH:mm")}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!t.receipt_path ? (
                      <span className="text-xs text-alert">Sin comprobante</span>
                    ) : (
                      isOwner && (
                        // Link temporal armado en el momento (solo owners): nunca queda vencido.
                        <a
                          href={`/admin/confirmar/comprobante/${t.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline underline-offset-4"
                        >
                          Ver comprobante
                        </a>
                      )
                    )}
                    {isOwner ? (
                      <>
                        <form action={reject}>
                          <ConfirmSubmitButton variant="ghost" size="sm" confirmLabel="Sí, rechazar">
                            Rechazar
                          </ConfirmSubmitButton>
                        </form>
                        {t.receipt_path && (
                          <form action={approve}>
                            <SubmitButton size="sm">Aprobar</SubmitButton>
                          </form>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-bone/50">Solo los owners validan</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Nueva entrada</h2>
        <NewTicketForm eventId={params.id} tiers={tierOptions} />
      </section>

      <section id="lista" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Entradas ({listedTotal})</h2>
          <form className="w-full sm:w-72">
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre, CI, email o IG" aria-label="Buscar entradas" />
          </form>
        </div>

        {outcome && (
          <div
            role="status"
            className={cn(
              'flex items-start justify-between gap-3 rounded-card border px-4 py-3 text-sm',
              outcome.ok ? 'border-bone/20 bg-bone/[0.04] text-bone/85' : 'border-alert/40 text-bone/85',
            )}
          >
            <p>
              {outcomeTicket?.buyer_name && <span className="font-medium">{outcomeTicket.buyer_name}: </span>}
              {outcome.text}
            </p>
            <Link href={pageHref(page)} aria-label="Cerrar aviso" className="shrink-0 text-bone/50 hover:text-bone">
              ✕
            </Link>
          </div>
        )}

        {listed.length === 0 ? (
          <EmptyState title={q ? 'Sin resultados' : 'Todavía no hay entradas'}>
            {q ? (
              <Link href={`/admin/events/${params.id}/tickets`} className="underline">
                Limpiar búsqueda
              </Link>
            ) : (
              'Cargá la primera arriba.'
            )}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {listed.map((t) => {
              const cancel = cancelTicketAction.bind(null, params.id, t.id, view);
              const resend = resendTicketMailAction.bind(null, params.id, t.id);
              // Una compra pendiente no se anula: vence sola (y si paga después, revive igual).
              const refundable = t.source === 'purchase' && !!t.mp_payment_id;
              const cancelMode = t.status !== 'paid' ? null : refundable ? 'refund' : 'cancel';
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{t.buyer_name}</p>
                      <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                      {buses.has(t.id) && <Badge tone="casa">Bus: {buses.get(t.id)?.name}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      CI {formatDocument(t.buyer_document)} · {t.buyer_email}
                      {t.buyer_instagram && ` · @${t.buyer_instagram}`}
                    </p>
                    <p className="mt-0.5 text-xs text-bone/45">
                      {SOURCE_LABELS[t.source]}
                      {t.source === 'purchase' && (t.payment_method === 'transfer' ? ' (transferencia)' : ' (Mercado Pago)')}
                      {t.tier_id && ` · ${tierName.get(t.tier_id) ?? ''}`}
                      {isOwner && Number(t.amount_paid_uyu) > 0 && ` · ${formatUYU(Number(t.amount_paid_uyu))}`}
                    </p>
                    {t.notes && (
                      <p className="mt-1 whitespace-pre-line text-xs text-bone/65">Nota: {t.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {t.qr_token && t.status !== 'pending' && <CopyLinkButton url={ticketUrl(t.qr_token)} />}
                    {t.status === 'paid' && (
                      <form action={resend}>
                        <SubmitButton variant="ghost" size="sm">
                          Reenviar mail
                        </SubmitButton>
                      </form>
                    )}
                    {cancelMode && <CancelTicketButton action={cancel} mode={cancelMode} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Páginas de entradas" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                ← Más nuevas
              </Link>
            ) : (
              <span />
            )}
            <span className="text-bone/55">
              Página {page} de {pages} · {PAGE_SIZE} por página
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Más viejas →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
