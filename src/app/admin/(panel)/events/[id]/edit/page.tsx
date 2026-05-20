import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { EventEditForm } from './event-edit-form'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import type { EventInput } from '@/lib/validation/schemas'
import type { TicketTier } from '@/types/database'

export const metadata = { title: 'Editar evento — Admin HOUSE MATES' }

const TZ = 'America/Montevideo'

function toLocalInput(iso: string) {
  return format(toZonedTime(new Date(iso), TZ), "yyyy-MM-dd'T'HH:mm")
}

export default async function EditEventPage({ params }: { params: { id: string } }) {
  await requireAdmin()
  const db = createAdminClient()

  const { data: event } = await db
    .from('events')
    .select('*, ticket_tiers(*)')
    .eq('id', params.id)
    .single()

  if (!event) notFound()

  const initial: EventInput = {
    title: event.title,
    slug: event.slug,
    date_start: toLocalInput(event.date_start),
    date_end: toLocalInput(event.date_end),
    location_name: event.location_name,
    location_url: event.location_url ?? '',
    capacity: event.capacity,
    status: event.status,
    description_md: event.description_md ?? '',
  }

  const tiers: TicketTier[] = ((event.ticket_tiers as TicketTier[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="max-w-2xl space-y-6">
      <EventEditForm id={params.id} initial={initial} existingTiers={tiers} />
    </div>
  )
}
