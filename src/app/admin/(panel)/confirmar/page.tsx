import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { getAdminUser } from '@/lib/auth/admin';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/card';
import { formatLocal, formatUYU } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, STATUS_LABELS } from '@/lib/tickets';
import { getTransportByTicket } from '@/lib/transport';
import { cn } from '@/lib/utils';
import { TransferReview } from './transfer-review';

export const metadata = { title: 'Entradas a confirmar' };

// Entradas a confirmar: las transferencias con comprobante de todos los eventos, la más vieja
// primero. Solo owners (el staff no ve plata ni comprobantes). Ver docs/LOGICA_DE_NEGOCIO.md →
// "Transferencia".
const OUTCOMES: Record<string, { ok: boolean; text: (name: string) => string }> = {
  aceptada: {
    ok: true,
    text: (n) => `Aceptaste la entrada de ${n}. Le mandamos el mail con la entrada y el QR.`,
  },
  'aceptada-sin-mail': {
    ok: false,
    text: (n) =>
      `Aceptaste la entrada de ${n}, pero no se pudo mandar el mail. Reenviáselo desde Entradas del evento.`,
  },
  declinada: {
    ok: true,
    text: (n) => `Declinaste la transferencia de ${n}. Se liberó el lugar y le avisamos por mail.`,
  },
  'declinada-sin-mail': {
    ok: false,
    text: (n) =>
      `Declinaste la transferencia de ${n} y se liberó el lugar, pero no se pudo mandar el mail: avisale por Instagram.`,
  },
  'ya-resuelta': {
    ok: false,
    text: (n) => `La transferencia de ${n} ya estaba resuelta: no se cambió nada.`,
  },
  'sin-comprobante': {
    ok: false,
    text: (n) => `La transferencia de ${n} no tiene comprobante: no se puede aceptar.`,
  },
  error: { ok: false, text: () => 'No se pudo completar. Probá de nuevo.' },
};

export default async function ConfirmTransfersPage({
  searchParams,
}: {
  searchParams: { evento?: string; hecho?: string; entrada?: string };
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');
  if (admin.role !== 'owner') redirect('/admin');

  const db = createAdminClient();
  const hecho = searchParams.hecho;
  const outcome = hecho && Object.hasOwn(OUTCOMES, hecho) ? OUTCOMES[hecho] : undefined;
  const [{ data: rows }, { data: resolved }] = await Promise.all([
    db
      .from('tickets')
      .select(
        'id, event_id, buyer_name, buyer_email, buyer_document, buyer_phone, buyer_instagram, amount_paid_uyu, discount_uyu, discount_code_id, receipt_path, created_at, events(title), ticket_tiers(name)',
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

  const all = rows ?? [];
  const events = new Map<string, { title: string; count: number }>();
  for (const t of all) {
    const e = events.get(t.event_id) ?? { title: t.events?.title ?? 'Evento', count: 0 };
    events.set(t.event_id, { ...e, count: e.count + 1 });
  }
  // Si ese evento ya no tiene pendientes (se resolvió la última), se muestran todas.
  const eventFilter =
    searchParams.evento && events.has(searchParams.evento) ? searchParams.evento : null;
  const listed = eventFilter ? all.filter((t) => t.event_id === eventFilter) : all;

  const codeIds = Array.from(
    new Set(listed.map((t) => t.discount_code_id).filter((id): id is string => !!id)),
  );
  const [busMaps, { data: codes }] = await Promise.all([
    Promise.all(
      Array.from(new Set(listed.map((t) => t.event_id))).map((eventId) =>
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
        description="Transferencias con comprobante. Fijate que la plata haya llegado a la cuenta antes de aceptar: al aceptar le llega la entrada con el QR; al declinar se libera el lugar y le avisamos por mail."
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
            {outcome.text(resolved?.buyer_name ?? 'esa persona')}
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
            {listed.length === 1 ? '1 esperando' : `${listed.length} esperando`} · la más vieja
            primero
          </p>
          <ul className="grid items-start gap-4 lg:grid-cols-2">
            {listed.map((t) => {
              const bus = buses.get(t.id);
              const total = Number(t.amount_paid_uyu);
              const discount = Number(t.discount_uyu);
              // Transferencia: total = (precio − descuento) + transporte, sin cargo por servicio.
              const entryPrice = total - (bus?.price ?? 0) + discount;
              const code = t.discount_code_id ? codeName.get(t.discount_code_id) : null;
              const receipt = !t.receipt_path
                ? null
                : t.receipt_path.endsWith('.pdf')
                  ? 'pdf'
                  : 'image';
              return (
                <li
                  key={t.id}
                  className="space-y-4 rounded-card border border-bone/10 bg-bone/[0.03] p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bone/45">
                        {t.events?.title ?? 'Evento'} · {t.ticket_tiers?.name ?? 'Entrada'}
                      </p>
                      <h2 className="mt-1.5 text-lg font-bold leading-snug tracking-tight">
                        {t.buyer_name}
                      </h2>
                    </div>
                    <p className="shrink-0 pt-0.5 text-xs text-bone/50">
                      {formatDistanceToNowStrict(new Date(t.created_at), {
                        locale: es,
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-bone/45">CI</dt>
                    <dd className="tabular-nums">{formatDocument(t.buyer_document)}</dd>
                    <dt className="text-bone/45">Email</dt>
                    <dd className="break-words">{t.buyer_email}</dd>
                    {t.buyer_phone && (
                      <>
                        <dt className="text-bone/45">Celular</dt>
                        <dd className="tabular-nums">{t.buyer_phone}</dd>
                      </>
                    )}
                    {t.buyer_instagram && (
                      <>
                        <dt className="text-bone/45">Instagram</dt>
                        <dd>@{t.buyer_instagram}</dd>
                      </>
                    )}
                    <dt className="text-bone/45">Enviado</dt>
                    <dd>{formatLocal(t.created_at, "EEE d/MM 'a las' HH:mm 'hs'")}</dd>
                  </dl>

                  <dl className="space-y-1.5 rounded-control border border-bone/10 px-4 py-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-bone/60">
                        Entrada · {t.ticket_tiers?.name ?? 'Entrada'}
                      </dt>
                      <dd className="tabular-nums">{formatUYU(entryPrice)}</dd>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-bone/60">Descuento{code && ` (${code})`}</dt>
                        <dd className="tabular-nums">−{formatUYU(discount)}</dd>
                      </div>
                    )}
                    {bus && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-bone/60">Transporte · {bus.name}</dt>
                        <dd className="tabular-nums">{formatUYU(bus.price)}</dd>
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
                    ticketId={t.id}
                    buyerName={t.buyer_name}
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
