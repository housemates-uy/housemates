import Link from 'next/link';
import { CopyPlus, Pencil } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { ContextMenu, ContextMenuButton, type ContextMenuItem } from '@/components/admin/context-menu';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/events/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { EVENT_DELETE_BLOCKERS, formatLocal } from '@/lib/events';
import { cn } from '@/lib/utils';
import { archiveEventAction, deleteEventAction, unarchiveEventAction } from './[id]/actions';

export const metadata = { title: 'Eventos' };

type EventRow = { id: string; title: string; status: string };

// Editar, duplicar, archivar y eliminar: solo owners. Eliminar solo si el evento nunca tuvo
// entradas, pedidos de barra ni escaneos; si no, se archiva.
function eventMenu(event: EventRow, blocker: string | null): ContextMenuItem[] {
  const reason = blocker ? (EVENT_DELETE_BLOCKERS[blocker] ?? 'Tiene datos') : null;
  const archived = event.status === 'archived';
  return [
    { label: 'Editar', href: `/admin/events/${event.id}/edit` },
    { label: 'Duplicar para otra fecha', href: `/admin/events/${event.id}/duplicar` },
    archived
      ? {
          label: 'Desarchivar',
          hint: reason ? `${reason}: no se puede eliminar` : 'Vuelve como borrador',
          action: unarchiveEventAction.bind(null, event.id),
        }
      : {
          label: 'Archivar',
          hint: reason ? `${reason}: se puede archivar` : undefined,
          action: archiveEventAction.bind(null, event.id),
          confirm: {
            title: `¿Archivar ${event.title}?`,
            body: 'Se apagan las ventas y deja de mostrarse. Después se puede desarchivar.',
            label: 'Sí, archivar',
          },
        },
    ...(reason
      ? []
      : [
          {
            label: 'Eliminar',
            danger: true,
            action: deleteEventAction.bind(null, event.id),
            confirm: {
              title: `¿Eliminar ${event.title}?`,
              body: 'Se borra con sus tandas, transporte, carta y códigos. No se puede deshacer.',
              label: 'Sí, eliminar',
            },
          },
        ]),
  ];
}

export default async function EventsPage() {
  const admin = await requireAdmin();
  const isOwner = admin.role === 'owner';
  const db = createAdminClient();

  const { data: events } = await db
    .from('events')
    .select('id, title, slug, date_start, status, capacity, sales_active')
    .order('date_start', { ascending: false });

  const blockers = new Map(
    isOwner
      ? await Promise.all(
          (events ?? []).map(async (e) => {
            const { data } = await db.rpc('event_delete_blocker', { p_event_id: e.id });
            return [e.id, data ?? null] as const;
          }),
        )
      : [],
  );

  // En el celular los botones ocupan el ancho y tienen 44 px de alto, para el pulgar.
  const rowButton = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-sm:h-11 max-sm:flex-1');

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Eventos"
        description={`${events?.length ?? 0} evento${events?.length !== 1 ? 's' : ''}`}
        action={
          isOwner ? (
            <Link href="/admin/events/new" className={buttonVariants({ size: 'sm' })}>
              Nuevo evento
            </Link>
          ) : undefined
        }
      />

      {events && events.length > 0 ? (
        <ul className="divide-y divide-bone/10 overflow-hidden rounded-card border border-bone/10">
          {events.map((event) => (
            <ContextMenu
              key={event.id}
              as="li"
              label={`Acciones de ${event.title}`}
              items={isOwner ? eventMenu(event, blockers.get(event.id) ?? null) : []}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-bone/5 sm:flex-nowrap"
            >
              <Link
                href={`/admin/events/${event.id}`}
                className="flex min-w-0 basis-full flex-wrap items-center justify-between gap-3 rounded-control sm:flex-1 sm:basis-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-0.5 text-xs text-bone/55">
                    {formatLocal(event.date_start, "d 'de' MMMM yyyy, HH:mm")} · {event.capacity} lugares
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {event.sales_active && <span className="text-xs text-bone/60">Ventas activas</span>}
                  <StatusBadge status={event.status} />
                </div>
              </Link>
              {isOwner && (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Link href={`/admin/events/${event.id}/edit`} className={rowButton} aria-label={`Editar ${event.title}`}>
                    <Pencil size={14} strokeWidth={1.5} aria-hidden />
                    Editar
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/duplicar`}
                    className={rowButton}
                    aria-label={`Duplicar ${event.title} para otra fecha`}
                  >
                    <CopyPlus size={14} strokeWidth={1.5} aria-hidden />
                    Duplicar
                  </Link>
                  <ContextMenuButton />
                </div>
              )}
            </ContextMenu>
          ))}
        </ul>
      ) : (
        <EmptyState title="Sin eventos">Creá el primero con “Nuevo evento”.</EmptyState>
      )}
    </div>
  );
}
