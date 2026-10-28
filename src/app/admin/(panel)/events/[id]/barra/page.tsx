import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, StatCard } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth/admin';
import { BAR_STATUS_LABELS, groupUnits } from '@/lib/bar';
import { formatLocal, formatUYU } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { moveBarProductAction, setBarPausedAction, toggleBarProductAction } from './actions';
import { ProductForm } from './product-form';

export const metadata = { title: 'Barra' };

const ORDERS_SHOWN = 100;

// Barra del evento: venta abierta/pausada, resumen, carta y pedidos.
// Los tragos se venden en /barra cuando este es el próximo evento publicado. Cada unidad
// comprada es un QR que se entrega una sola vez en el escáner de barra (/admin/barra/<id>).
export default async function EventBarPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { agregado?: string; guardado?: string };
}) {
  const admin = await requireAdmin();
  const isOwner = admin.role === 'owner';
  const db = createAdminClient();

  const [{ data: event }, { data: products }, { data: summary }, { count: paidOrders }, { data: orders }] =
    await Promise.all([
      db.from('events').select('id, status, date_end, bar_paused').eq('id', params.id).single(),
      db
        .from('bar_products')
        .select('id, name, description, price_uyu, active, sort_order')
        .eq('event_id', params.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      db.rpc('bar_summary', { p_event_id: params.id }),
      db
        .from('bar_orders')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', params.id)
        .eq('status', 'paid'),
      db
        .from('bar_orders')
        .select(
          'id, status, buyer_email, buyer_name, total_uyu, created_at, access_token, bar_order_units(product_name, unit_price_uyu, delivered_at, position)',
        )
        .eq('event_id', params.id)
        .order('created_at', { ascending: false })
        .limit(ORDERS_SHOWN),
    ]);
  if (!event) notFound();

  const rows = summary ?? [];
  const sold = rows.reduce((s, r) => s + r.sold, 0);
  const delivered = rows.reduce((s, r) => s + r.delivered, 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const ended = new Date(event.date_end) < new Date();
  const list = products ?? [];

  return (
    <div className="max-w-4xl space-y-10">
      {/* Venta */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-bone/10 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Venta de barra</p>
            <Badge tone={event.bar_paused || ended ? 'neutral' : 'club'}>
              {ended ? 'Terminó' : event.bar_paused ? 'Pausada' : 'Abierta'}
            </Badge>
          </div>
          <p className="mt-1 max-w-[60ch] text-xs leading-relaxed text-bone/55">
            {event.bar_paused
              ? 'Nadie puede comprar. Los QRs ya pagos se siguen entregando.'
              : 'Se compra desde /barra cuando este es el próximo evento publicado, hasta que termine. Precio final, sin cargo por servicio.'}
            {event.status !== 'published' && ' El evento no está publicado: la barra no vende.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <form action={setBarPausedAction.bind(null, event.id, !event.bar_paused)}>
              <SubmitButton variant="outline" size="sm">
                {event.bar_paused ? 'Reanudar venta' : 'Pausar venta'}
              </SubmitButton>
            </form>
          )}
          <Link href={`/admin/barra/${event.id}`} className={buttonVariants({ size: 'sm' })}>
            Abrir escáner de barra
          </Link>
        </div>
      </section>

      {/* Resumen */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Pedidos pagos" value={paidOrders ?? 0} />
          <StatCard label="Total vendido" value={formatUYU(revenue)} />
          <StatCard label="Tragos vendidos" value={sold} />
          <StatCard label="Entregados" value={delivered} sub={`${sold - delivered} para retirar`} />
        </div>
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-card border border-bone/10">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-bone/50">
                <tr className="border-b border-bone/10">
                  <th className="px-5 py-3 font-medium">Trago</th>
                  <th className="px-3 py-3 text-right font-medium">Vendidos</th>
                  <th className="px-3 py-3 text-right font-medium">Entregados</th>
                  <th className="px-3 py-3 text-right font-medium">Para retirar</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bone/10">
                {rows.map((r) => (
                  <tr key={r.product_id ?? r.product_name}>
                    <td className="px-5 py-3">{r.product_name}</td>
                    <td className="px-3 py-3 text-right">{r.sold}</td>
                    <td className="px-3 py-3 text-right">{r.delivered}</td>
                    <td className="px-3 py-3 text-right">{r.sold - r.delivered}</td>
                    <td className="px-5 py-3 text-right">{formatUYU(Number(r.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Carta */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Carta ({list.length})</h2>
          <p className="mt-1 text-sm text-bone/55">
            {isOwner
              ? 'El orden de esta lista es el de /barra. Cambiar un precio no toca los pedidos ya hechos.'
              : 'Solo los owners pueden cambiar la carta y pausar la venta.'}
          </p>
        </div>

        {list.length === 0 ? (
          <EmptyState title="Todavía no hay tragos">
            {isOwner ? 'Agregá el primero abajo.' : 'Pedile a un owner que cargue la carta.'}
          </EmptyState>
        ) : (
          <ul aria-label="Carta" className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {list.map((p, i) => (
              <li key={p.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      {!p.active && <Badge>Inactivo</Badge>}
                      {searchParams.guardado === p.id && (
                        <span role="status" className="text-xs text-bone/60">
                          Guardado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      {formatUYU(Number(p.price_uyu))}
                      {p.description && ` · ${p.description}`}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <form action={moveBarProductAction.bind(null, params.id, p.id, -1)}>
                        <SubmitButton variant="ghost" size="sm" disabled={i === 0} aria-label={`Subir ${p.name}`}>
                          <ArrowUp size={14} aria-hidden />
                        </SubmitButton>
                      </form>
                      <form action={moveBarProductAction.bind(null, params.id, p.id, 1)}>
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          disabled={i === list.length - 1}
                          aria-label={`Bajar ${p.name}`}
                        >
                          <ArrowDown size={14} aria-hidden />
                        </SubmitButton>
                      </form>
                      <form action={toggleBarProductAction.bind(null, params.id, p.id, !p.active)}>
                        <SubmitButton variant="ghost" size="sm">
                          {p.active ? 'Desactivar' : 'Activar'}
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </div>
                {isOwner && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer list-none text-xs text-bone/55 underline-offset-4 hover:text-bone hover:underline">
                      <span className="group-open:hidden">Editar</span>
                      <span className="hidden group-open:inline">Cerrar edición</span>
                    </summary>
                    <div className="mt-4 rounded-card border border-bone/10 p-5">
                      <ProductForm
                        eventId={params.id}
                        product={{ id: p.id, name: p.name, description: p.description, price: Number(p.price_uyu) }}
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && (
          <div className="rounded-card border border-bone/10 p-5">
            <h3 className="mb-4 text-sm font-medium text-bone/80">Nuevo trago</h3>
            <ProductForm
              eventId={params.id}
              notice={searchParams.agregado ? `${searchParams.agregado} agregado a la carta.` : undefined}
            />
          </div>
        )}
      </section>

      {/* Pedidos */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">
          Pedidos{(orders ?? []).length === ORDERS_SHOWN && ` (últimos ${ORDERS_SHOWN})`}
        </h2>
        {(orders ?? []).length === 0 ? (
          <EmptyState title="Todavía no hay pedidos" />
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {(orders ?? []).map((o) => {
              const units = [...o.bar_order_units].sort((a, b) => a.position - b.position);
              const done = units.filter((u) => u.delivered_at).length;
              const lines = groupUnits(units.map((u) => ({ name: u.product_name, price: Number(u.unit_price_uyu) })));
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{o.buyer_name || o.buyer_email}</p>
                      <Badge tone={o.status === 'paid' ? 'club' : o.status === 'pending' ? 'neutral' : 'alert'}>
                        {BAR_STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      {o.buyer_name && `${o.buyer_email} · `}
                      {lines.map((l) => `${l.quantity} × ${l.name}`).join(', ')}
                    </p>
                    <p className="mt-1 text-xs text-bone/45">
                      {formatLocal(o.created_at, "d/MM HH:mm")}
                      {o.status === 'paid' && ` · ${done} de ${units.length} entregados`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatUYU(Number(o.total_uyu))}</span>
                    <a
                      href={`/barra/pedido/${o.access_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-bone/55 underline-offset-4 hover:text-bone hover:underline"
                    >
                      Ver pedido
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
