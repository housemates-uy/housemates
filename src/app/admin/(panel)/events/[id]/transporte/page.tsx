import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, Printer } from 'lucide-react';
import { ContextMenu, ContextMenuButton } from '@/components/admin/context-menu';
import { SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, StatCard } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth/admin';
import { formatUYU } from '@/lib/events';
import type { TicketStatus } from '@/types/database';
import { deleteTransportOptionAction, toggleTransportOptionAction } from './actions';
import { OptionForm } from './option-form';
import { getPassengers } from './passengers';

export const metadata = { title: 'Transporte' };

const STATUS_TONE: Partial<Record<TicketStatus, 'solid' | 'neutral' | 'alert' | 'club'>> = {
  paid: 'solid',
  used: 'club',
  review: 'alert',
  pending: 'neutral',
};

// Transporte del evento: las opciones de bus que se ofrecen al comprar ("¿Necesitás
// transporte?") y la lista de pasajeros de cada una para el chofer.
export default async function EventTransportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { agregada?: string; guardada?: string };
}) {
  const admin = await requireAdmin();
  const isOwner = admin.role === 'owner';
  const data = await getPassengers(params.id);
  if (!data) notFound();

  const { options } = data;
  const confirmed = options.reduce((s, o) => s + o.confirmed.length, 0);
  const inProgress = options.reduce((s, o) => s + o.passengers.length - o.confirmed.length, 0);
  const revenue = options.reduce((s, o) => s + o.confirmed.reduce((t, p) => t + p.price, 0), 0);
  const base = `/admin/events/${params.id}/transporte`;
  // Una opción desactivada sin nadie anotado no aporta nada a la lista de pasajeros.
  const withPassengers = options.filter((o) => o.active || o.passengers.length > 0);

  return (
    <div className="max-w-4xl space-y-10">
      <section className="space-y-4">
        <p className="max-w-[70ch] text-sm leading-relaxed text-bone/60">
          Al comprar, la persona ve &quot;¿Necesitás transporte?&quot; con las opciones activas. El precio se
          suma a la entrada (el código de descuento no lo toca) y con Mercado Pago lleva el cargo por
          servicio. Si la entrada se anula o se rechaza la transferencia, el lugar del bus se libera solo.
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Pasajeros" value={confirmed} sub="Con la entrada válida" />
          <StatCard label="A confirmar" value={inProgress} sub="Transferencias y pagos en curso" />
          {isOwner && <StatCard label="Recaudado en bus" value={formatUYU(revenue)} />}
        </div>
      </section>

      {/* Opciones */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Opciones ({options.length})</h2>
          <p className="mt-1 text-sm text-bone/55">
            {isOwner
              ? 'Cambiar el precio no toca a quienes ya compraron. Una opción que alguien eligió no se elimina: se desactiva. Eliminar está en el menú de cada opción (⋯ o clic derecho).'
              : 'Solo los owners pueden cambiar las opciones de transporte.'}
          </p>
        </div>

        {options.length === 0 ? (
          <EmptyState title="Todavía no hay transporte">
            {isOwner
              ? 'Agregá la primera opción abajo. Sin opciones activas, la compra no muestra la pregunta.'
              : 'Pedile a un owner que cargue las opciones.'}
          </EmptyState>
        ) : (
          <ul aria-label="Opciones de transporte" className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {options.map((o) => (
              <ContextMenu
                key={o.id}
                as="li"
                label={`Acciones de ${o.name}`}
                items={
                  isOwner
                    ? [
                        { label: 'Editar', reveal: `editar-${o.id}` },
                        {
                          label: o.active ? 'Desactivar' : 'Activar',
                          hint: o.everReserved
                            ? `Alguien la eligió: ${o.active ? 'se puede desactivar' : 'no se puede eliminar'}`
                            : undefined,
                          action: toggleTransportOptionAction.bind(null, params.id, o.id, !o.active),
                        },
                        ...(o.everReserved
                          ? []
                          : [
                              {
                                label: 'Eliminar',
                                danger: true,
                                action: deleteTransportOptionAction.bind(null, params.id, o.id),
                                confirm: { title: `¿Eliminar ${o.name}?`, body: 'No se puede deshacer.', label: 'Sí, eliminar' },
                              },
                            ]),
                      ]
                    : []
                }
                className="px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{o.name}</p>
                      <Badge tone={!o.active ? 'neutral' : o.left === 0 ? 'alert' : 'club'}>
                        {!o.active ? 'Inactiva' : o.left === 0 ? 'Completa' : 'Activa'}
                      </Badge>
                      {searchParams.guardada === o.id && (
                        <span role="status" className="text-xs text-bone/60">
                          Guardado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      {formatUYU(o.price)}
                      {' · '}
                      {o.capacity !== null
                        ? `${o.taken} de ${o.capacity} lugares`
                        : `${o.taken} ${o.taken === 1 ? 'lugar' : 'lugares'} · sin tope`}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs text-bone/45">{o.departure}</p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <form action={toggleTransportOptionAction.bind(null, params.id, o.id, !o.active)}>
                        <SubmitButton variant="ghost" size="sm">
                          {o.active ? 'Desactivar' : 'Activar'}
                        </SubmitButton>
                      </form>
                      <ContextMenuButton />
                    </div>
                  )}
                </div>
                {isOwner && (
                  <details id={`editar-${o.id}`} className="group mt-2">
                    <summary className="cursor-pointer list-none text-xs text-bone/55 underline-offset-4 hover:text-bone hover:underline">
                      <span className="group-open:hidden">Editar</span>
                      <span className="hidden group-open:inline">Cerrar edición</span>
                    </summary>
                    <div className="mt-4 rounded-card border border-bone/10 p-5">
                      <OptionForm
                        eventId={params.id}
                        option={{
                          id: o.id,
                          name: o.name,
                          departure: o.departure,
                          price: o.price,
                          capacity: o.capacity,
                        }}
                      />
                    </div>
                  </details>
                )}
              </ContextMenu>
            ))}
          </ul>
        )}

        {isOwner && (
          <div className="rounded-card border border-bone/10 p-5">
            <h3 className="mb-4 text-sm font-medium text-bone/80">Nueva opción</h3>
            <OptionForm
              eventId={params.id}
              notice={searchParams.agregada ? `${searchParams.agregada} agregada.` : undefined}
            />
          </div>
        )}
      </section>

      {/* Pasajeros */}
      {withPassengers.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Pasajeros</h2>
              <p className="mt-1 text-sm text-bone/55">
                La lista para el chofer (CSV e imprimible) lleva solo a quienes tienen la entrada válida.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`${base}/pasajeros`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Download size={14} strokeWidth={1.5} aria-hidden />
                Descargar CSV
              </a>
              <Link href={`${base}/imprimir`} className={buttonVariants({ size: 'sm' })}>
                <Printer size={14} strokeWidth={1.5} aria-hidden />
                Imprimir
              </Link>
            </div>
          </div>

          {withPassengers.map((o) => (
            <div key={o.id} className="rounded-card border border-bone/10">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bone/10 px-5 py-3">
                <p className="text-sm font-medium">
                  {o.name}{' '}
                  <span className="text-bone/55">
                    · {o.confirmed.length} {o.confirmed.length === 1 ? 'pasajero' : 'pasajeros'}
                    {o.passengers.length > o.confirmed.length &&
                      ` + ${o.passengers.length - o.confirmed.length} a confirmar`}
                  </span>
                </p>
                {o.confirmed.length > 0 && (
                  <div className="flex items-center gap-3 text-xs">
                    <a href={`${base}/pasajeros?opcion=${o.id}`} className="text-bone/60 underline-offset-4 hover:text-bone hover:underline">
                      CSV
                    </a>
                    <Link href={`${base}/imprimir?opcion=${o.id}`} className="text-bone/60 underline-offset-4 hover:text-bone hover:underline">
                      Imprimir
                    </Link>
                  </div>
                )}
              </div>
              {o.passengers.length === 0 ? (
                <p className="px-5 py-4 text-sm text-bone/45">Nadie eligió esta opción todavía.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs text-bone/50">
                      <tr className="border-b border-bone/10">
                        <th className="px-5 py-2.5 font-medium">Nombre</th>
                        <th className="px-3 py-2.5 font-medium">Cédula</th>
                        <th className="px-3 py-2.5 font-medium">Celular</th>
                        <th className="px-5 py-2.5 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bone/10">
                      {o.passengers.map((p) => (
                        <tr key={`${p.document}-${p.email}`}>
                          <td className="px-5 py-2.5">{p.name}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{p.document}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{p.phone || '—'}</td>
                          <td className="px-5 py-2.5">
                            <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.statusLabel}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
