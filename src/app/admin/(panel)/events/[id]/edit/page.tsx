import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { toLocalInput } from '@/lib/events';
import type { EventInput } from '@/lib/validation/schemas';
import type { TicketTier } from '@/types/database';
import { EventEditForm } from './event-edit-form';

export const metadata = { title: 'Editar evento' };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { copiado?: string };
}) {
  const admin = await requireAdmin();
  // Editar fechas, capacidad, tandas y precios: solo los owners.
  if (admin.role !== 'owner') redirect(`/admin/events/${params.id}`);
  const db = createAdminClient();

  const { data: event } = await db
    .from('events')
    .select('*, ticket_tiers(*)')
    .eq('id', params.id)
    .single();

  if (!event) notFound();

  const initial: EventInput = {
    title: event.title,
    slug: event.slug,
    date_start: toLocalInput(event.date_start),
    date_end: toLocalInput(event.date_end),
    location_name: event.location_name,
    location_url: event.location_url ?? '',
    format: event.format,
    capacity: event.capacity,
    status: event.status,
    description_md: event.description_md ?? '',
  };

  const tiers: TicketTier[] = ((event.ticket_tiers as TicketTier[]) ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  // Una tanda con alguna entrada (de cualquier estado) no se elimina: se desactiva.
  const tiersWithTickets = (
    await Promise.all(
      tiers.map(async (t) => {
        const { count } = await db.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', t.id);
        return count ? t.id : null;
      }),
    )
  ).filter((id): id is string => id !== null);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Viene de "Duplicar para otra fecha": por la URL, para que sobreviva al refresh. */}
      {searchParams.copiado === '1' && (
        <p role="status" className="rounded-control border border-bone/25 bg-bone/[0.04] px-4 py-3 text-sm text-bone/85">
          Evento copiado como borrador. Revisá lugar, tandas y precios, transporte y la carta de la barra antes de
          publicarlo.
        </p>
      )}
      <EventEditForm
        id={params.id}
        initial={initial}
        existingTiers={tiers}
        tiersWithTickets={tiersWithTickets}
        isOwner={admin.role === 'owner'}
      />
    </div>
  );
}
