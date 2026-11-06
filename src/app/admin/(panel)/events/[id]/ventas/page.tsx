import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Download, Printer } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient, fetchAll } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/card';
import { formatLocal, formatUYU } from '@/lib/events';
import { cn } from '@/lib/utils';
import { LiveRefresh } from './live-refresh';
import { SalesByDay, type DaySales } from './sales-by-day';

export const metadata = { title: 'Ventas' };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_DAYS = 60;
const LIVE_REFRESH_SECONDS = 10;

const share = (part: number, whole: number) => (whole > 0 ? Math.min(part / whole, 1) : 0);
const percent = (part: number, whole: number) =>
  share(part, whole).toLocaleString('es-UY', { style: 'percent', maximumFractionDigits: 1 });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// Mediodía en Montevideo de un día "yyyy-MM-dd": sirve para formatear la fecha sin correrla.
const noonOf = (key: string) => `${key}T15:00:00Z`;

function Meter({ parts, label }: { parts: { value: number; className: string }[]; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-bone/10"
    >
      {parts
        .filter((p) => p.value > 0)
        .map((p, i) => (
          <div
            key={i}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', p.className)}
            style={{ width: `${p.value * 100}%` }}
          />
        ))}
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={cn('inline-block h-2 w-2 rounded-full', className)} />;
}

// Panel de ventas de un evento: entradas contra capacidad, tandas, plata, descuentos,
// ventas por día y, el día del evento, la puerta en vivo. La plata la ven solo los owners;
// el staff ve cantidades.
export default async function EventSalesPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const isOwner = admin.role === 'owner';
  const db = createAdminClient();
  const now = Date.now();

  // Las entradas se traen de a páginas: PostgREST corta en 1000 filas y los totales quedarían cortos.
  const [{ data: event }, { data: tiers }, all, paying, { data: codes }, buses] =
    await Promise.all([
      db
        .from('events')
        .select('capacity, date_start, date_end, door_closed')
        .eq('id', params.id)
        .single(),
      db
        .from('ticket_tiers')
        .select('id, name, price_uyu, quantity_total, quantity_sold, sold_out_override, active')
        .eq('event_id', params.id)
        .order('sort_order'),
      fetchAll((from, to) =>
        db
          .from('tickets')
          .select(
            'status, source, payment_method, tier_id, amount_paid_uyu, discount_uyu, discount_code_id, created_at, used_at',
          )
          .eq('event_id', params.id)
          .in('status', ['paid', 'used', 'review'])
          .order('created_at')
          .order('id')
          .range(from, to),
      ),
      // Compras con Mercado Pago en curso (reserva sin vencer). Las vencidas son abandonos.
      fetchAll((from, to) =>
        db
          .from('tickets')
          .select('discount_code_id')
          .eq('event_id', params.id)
          .eq('status', 'pending')
          .gt('reserved_until', new Date(now).toISOString())
          .order('id')
          .range(from, to),
      ),
      db
        .from('discount_codes')
        .select('id, code, max_uses, active')
        .eq('event_id', params.id)
        .order('created_at'),
      // Lo que se cobró de bus en las entradas válidas: va dentro de amount_paid_uyu.
      isOwner
        ? fetchAll((from, to) =>
            db
              .from('ticket_transport')
              .select('price_uyu, tickets!inner(status)')
              .eq('event_id', params.id)
              .in('tickets.status', ['paid', 'used'])
              .order('ticket_id')
              .range(from, to),
          )
        : Promise.resolve([]),
    ]);

  if (!event) notFound();

  const tierRows = await Promise.all(
    (tiers ?? []).map(async (t) => {
      const { data } = await db.rpc('tier_available', { p_tier_id: t.id });
      const available = (data as number | null) ?? 0;
      return {
        ...t,
        available: Math.max(available, 0),
        held: Math.max(t.quantity_total - t.quantity_sold - available, 0),
      };
    }),
  );

  const valid = all.filter((t) => t.status === 'paid' || t.status === 'used');
  const inside = valid.filter((t) => t.status === 'used');
  const toReview = all.filter((t) => t.status === 'review');
  const invitations = valid.filter((t) => t.source === 'invitation');
  const sold = valid.filter((t) => t.source !== 'invitation');
  const inProgress = toReview.length + paying.length;
  const sum = (list: { amount_paid_uyu: number }[]) =>
    list.reduce((s, t) => s + Number(t.amount_paid_uyu), 0);
  const revenue = sum(sold);
  const busRevenue = buses.reduce((s, b) => s + Number(b.price_uyu), 0);
  const capacity = event.capacity;
  const free = Math.max(capacity - valid.length - inProgress, 0);

  const methods = [
    {
      label: 'Mercado Pago',
      note: 'Incluye cargo por servicio y transporte',
      list: sold.filter((t) => t.source === 'purchase' && t.payment_method !== 'transfer'),
    },
    {
      label: 'Transferencia',
      note: 'Compra web con comprobante (incluye transporte)',
      list: sold.filter((t) => t.source === 'purchase' && t.payment_method === 'transfer'),
    },
    {
      label: 'Manual',
      note: 'Cargadas desde el admin',
      list: sold.filter((t) => t.source === 'manual'),
    },
  ];

  const codeRows = (codes ?? []).map((c) => {
    const confirmed = valid.filter((t) => t.discount_code_id === c.id);
    return {
      ...c,
      uses: confirmed.length,
      pending:
        toReview.filter((t) => t.discount_code_id === c.id).length +
        paying.filter((t) => t.discount_code_id === c.id).length,
      discounted: confirmed.reduce((s, t) => s + Number(t.discount_uyu), 0),
    };
  });
  const totalDiscounted = codeRows.reduce((s, c) => s + c.discounted, 0);

  // Ventas por día (fecha de compra, hora de Montevideo). Las invitaciones no son ventas.
  const byDay = new Map<string, { count: number; amount: number }>();
  for (const t of sold) {
    const key = formatLocal(t.created_at, 'yyyy-MM-dd');
    const day = byDay.get(key) ?? { count: 0, amount: 0 };
    day.count += 1;
    day.amount += Number(t.amount_paid_uyu);
    byDay.set(key, day);
  }
  const todayKey = formatLocal(new Date(now).toISOString(), 'yyyy-MM-dd');
  const eventDayKey = formatLocal(event.date_end, 'yyyy-MM-dd');
  const saleKeys = Array.from(byDay.keys()).sort();
  const days: DaySales[] = [];
  if (saleKeys.length > 0) {
    const lastKey =
      todayKey <= eventDayKey && todayKey > saleKeys[saleKeys.length - 1]
        ? todayKey
        : saleKeys[saleKeys.length - 1];
    const end = new Date(noonOf(lastKey)).getTime();
    const start = Math.max(new Date(noonOf(saleKeys[0])).getTime(), end - (MAX_DAYS - 1) * DAY);
    for (let ms = start; ms <= end; ms += DAY) {
      const iso = new Date(ms).toISOString();
      const key = formatLocal(iso, 'yyyy-MM-dd');
      const day = byDay.get(key) ?? { count: 0, amount: 0 };
      days.push({
        key,
        label: formatLocal(iso, 'd MMM'),
        longLabel: formatLocal(iso, "EEE d 'de' MMM"),
        ...day,
      });
    }
  }
  const trimmedDays = saleKeys.length > 0 && days[0].key > saleKeys[0];

  // "En vivo" desde unas horas antes de abrir hasta un rato después de cerrar.
  const live =
    now >= new Date(event.date_start).getTime() - 6 * HOUR &&
    now <= new Date(event.date_end).getTime() + 3 * HOUR;
  const lastEntry = inside.reduce<string | null>(
    (last, t) => (t.used_at && (!last || t.used_at > last) ? t.used_at : last),
    null,
  );
  const ticketsHref = `/admin/events/${params.id}/tickets`;

  return (
    <div className="max-w-5xl space-y-8">
      {live && <LiveRefresh seconds={LIVE_REFRESH_SECONDS} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-bone/45">
          Datos de las {formatLocal(new Date(now).toISOString(), 'HH:mm:ss')}
          {live && ` · se actualiza solo cada ${LIVE_REFRESH_SECONDS} s`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs text-bone/45 sm:w-auto">
            Lista de la puerta, por si falla el escáner:
          </span>
          <a
            href={`/admin/events/${params.id}/lista`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Download size={14} strokeWidth={1.5} aria-hidden />
            Descargar lista (CSV)
          </a>
          <Link
            href={`/admin/events/${params.id}/lista/imprimir`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Printer size={14} strokeWidth={1.5} aria-hidden />
            Imprimir lista
          </Link>
        </div>
      </div>

      {live && (
        <section
          aria-labelledby="puerta"
          className="rounded-card border border-bone/15 bg-bone/[0.03] p-5 md:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="puerta" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
              <span aria-hidden className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet" />
              </span>
              En vivo · Puerta
            </h2>
            <Badge tone={event.door_closed ? 'alert' : 'neutral'}>
              {event.door_closed ? 'Puerta cerrada' : 'Puerta abierta'}
            </Badge>
          </div>
          <p className="mt-5 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight md:text-6xl">{inside.length}</span>
            <span className="text-xl font-medium text-bone/45">/ {valid.length}</span>
          </p>
          <p className="mt-1 text-sm text-bone/60">
            adentro · {percent(inside.length, valid.length)} de las entradas válidas · faltan{' '}
            {valid.length - inside.length}
          </p>
          <div className="mt-4">
            <Meter
              label={`Ingresaron ${inside.length} de ${valid.length}`}
              parts={[{ value: share(inside.length, valid.length), className: 'bg-bone' }]}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-bone/45">
            <span>
              {lastEntry
                ? `Último ingreso ${formatLocal(lastEntry, 'HH:mm')}`
                : 'Todavía no entró nadie'}
            </span>
            <Link
              href={`/admin/scan/${params.id}`}
              className="inline-flex items-center gap-1 text-bone/70 hover:text-bone"
            >
              Abrir el escáner <ArrowRight size={12} strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </section>
      )}

      <div className={cn('grid gap-4', isOwner && 'lg:grid-cols-5 lg:items-start')}>
        <Card className="p-5 md:p-6 lg:col-span-3">
          <p className="text-[13px] text-bone/50">Entradas válidas</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight">{valid.length}</span>
            <span className="text-xl font-medium text-bone/45">/ {capacity}</span>
          </p>
          <p className="mt-1 text-sm text-bone/60">
            {percent(valid.length, capacity)} de la capacidad
          </p>
          <div className="mt-5">
            <Meter
              label={`${valid.length} válidas, ${inProgress} en curso y ${free} libres de ${capacity}`}
              parts={[
                { value: share(valid.length, capacity), className: 'bg-bone' },
                { value: share(inProgress, capacity), className: 'bg-bone/35' },
              ]}
            />
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-bone/60">
            <li className="flex items-center gap-1.5">
              <Swatch className="bg-bone" /> {plural(valid.length, 'válida', 'válidas')}
            </li>
            <li className="flex items-center gap-1.5">
              <Swatch className="bg-bone/35" /> {inProgress} en curso
            </li>
            <li className="flex items-center gap-1.5">
              <Swatch className="bg-bone/10" /> {plural(free, 'lugar libre', 'lugares libres')}
            </li>
          </ul>
          <dl className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-bone/10 pt-4 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-xs text-bone/45">Vendidas</dt>
              <dd className="mt-0.5 font-medium">{sold.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-bone/45">Invitaciones</dt>
              <dd className="mt-0.5 font-medium">{invitations.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-bone/45">Pagando ahora</dt>
              <dd className="mt-0.5 font-medium">{paying.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-bone/45">A validar</dt>
              <dd className="mt-0.5 font-medium">{toReview.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-bone/45">Ya entraron</dt>
              <dd className="mt-0.5 font-medium">{inside.length}</dd>
            </div>
          </dl>
        </Card>

        {isOwner && (
          <Card className="p-5 md:p-6 lg:col-span-2">
            <p className="text-[13px] text-bone/50">Recaudado</p>
            <p className="mt-2 text-4xl font-bold tracking-tight">{formatUYU(revenue)}</p>
            <p className="mt-1 text-sm text-bone/60">
              {plural(sold.length, 'entrada cobrada', 'entradas cobradas')} · incluye transporte y cargo
              por servicio
            </p>
            {busRevenue > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
                <div>
                  <dt className="text-xs text-bone/45">Entradas y cargo</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{formatUYU(revenue - busRevenue)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-bone/45">Transporte</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{formatUYU(busRevenue)}</dd>
                </div>
              </dl>
            )}
            <ul className="mt-5 space-y-4">
              {methods.map((m) => {
                const amount = sum(m.list);
                return (
                  <li key={m.label}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{m.label}</span>
                      <span className="font-medium tabular-nums">{formatUYU(amount)}</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-bone/45">
                      <span>{m.note}</span>
                      <span className="tabular-nums">
                        {plural(m.list.length, 'entrada', 'entradas')}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Meter
                        label={`${percent(amount, revenue)} de lo recaudado`}
                        parts={[{ value: share(amount, revenue), className: 'bg-bone/70' }]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 border-t border-bone/10 pt-3 text-xs text-bone/45">
              {plural(invitations.length, 'invitación', 'invitaciones')} aparte, sin cobro.
            </p>
          </Card>
        )}
      </div>

      {toReview.length > 0 && (
        <Link
          href={`${ticketsHref}#a-validar`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-alert/30 px-5 py-4 transition-colors hover:bg-bone/[0.03]"
        >
          <div>
            <p className="text-sm font-medium">
              {plural(toReview.length, 'transferencia a validar', 'transferencias a validar')}
              {isOwner && <span className="font-bold"> · {formatUYU(sum(toReview))}</span>}
            </p>
            <p className="mt-0.5 text-xs text-bone/55">
              {isOwner ? 'Todavía no cuentan en lo recaudado.' : 'Las valida un owner.'} Reservan el
              lugar hasta que se validen.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm">
            Ir a Entradas <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
          </span>
        </Link>
      )}

      <section aria-labelledby="tandas" className="space-y-4">
        <h2 id="tandas" className="text-lg font-bold tracking-tight">
          Por tanda
        </h2>
        {tierRows.length === 0 ? (
          <EmptyState title="El evento no tiene tandas" />
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {tierRows.map((t) => {
              const soldOut = t.available <= 0;
              return (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{t.name}</p>
                        {!t.active && <Badge>Inactiva</Badge>}
                        {soldOut ? (
                          <Badge tone="solid">Agotada</Badge>
                        ) : (
                          t.sold_out_override && <Badge>Agotada a mano</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-bone/50">{formatUYU(Number(t.price_uyu))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">
                        <span className="font-bold">{t.quantity_sold}</span>
                        <span className="text-bone/45"> / {t.quantity_total} vendidas</span>
                      </p>
                      <p className="mt-1 text-xs text-bone/50">
                        {plural(t.available, 'disponible', 'disponibles')}
                        {t.held > 0 && ` · ${t.held} en curso`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Meter
                      label={`${t.quantity_sold} vendidas de ${t.quantity_total}`}
                      parts={[
                        { value: share(t.quantity_sold, t.quantity_total), className: 'bg-bone' },
                        { value: share(t.held, t.quantity_total), className: 'bg-bone/35' },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium">Invitaciones</p>
                <p className="mt-1 text-xs text-bone/50">Sin tanda: no descuentan stock</p>
              </div>
              <p className="text-sm font-bold tabular-nums">{invitations.length}</p>
            </li>
          </ul>
        )}
      </section>

      <section aria-labelledby="por-dia" className="space-y-4">
        <div>
          <h2 id="por-dia" className="text-lg font-bold tracking-tight">
            Ventas por día
          </h2>
          <p className="mt-1 text-sm text-bone/55">
            Entradas vendidas por fecha de compra (sin invitaciones)
            {trimmedDays && `, últimos ${MAX_DAYS} días`}
            {isOwner && '. Los montos incluyen transporte y cargo por servicio'}.
          </p>
        </div>
        {days.length === 0 ? (
          <EmptyState title="Todavía no hay ventas" />
        ) : (
          <Card className="p-5 md:p-6">
            <SalesByDay days={days} showAmount={isOwner} />
          </Card>
        )}
      </section>

      <section aria-labelledby="codigos" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="codigos" className="text-lg font-bold tracking-tight">
              Códigos de descuento
            </h2>
            <p className="mt-1 text-sm text-bone/55">Usos en entradas válidas.</p>
          </div>
          {isOwner && totalDiscounted > 0 && (
            <p className="text-sm text-bone/60">
              Descontado en total:{' '}
              <span className="font-bold text-bone">{formatUYU(totalDiscounted)}</span>
            </p>
          )}
        </div>
        {codeRows.length === 0 ? (
          <EmptyState title="Este evento no tiene códigos">
            Se crean en{' '}
            <Link href={`/admin/events/${params.id}/descuentos`} className="underline">
              Descuentos
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-card border border-bone/10">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-bone/10 text-left text-xs text-bone/45">
                  <th className="px-5 py-3 font-normal">Código</th>
                  <th className="px-5 py-3 text-right font-normal">Usos</th>
                  {isOwner && <th className="px-5 py-3 text-right font-normal">Descontado</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-bone/10">
                {codeRows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3">
                      <span className="font-bold tracking-wide">{c.code}</span>
                      {!c.active && <span className="ml-2 text-xs text-bone/45">pausado</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.uses}
                      {c.max_uses !== null && <span className="text-bone/45"> / {c.max_uses}</span>}
                      {c.pending > 0 && (
                        <span className="block text-xs text-bone/45">+{c.pending} en curso</span>
                      )}
                    </td>
                    {isOwner && <td className="px-5 py-3 text-right">{formatUYU(c.discounted)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
