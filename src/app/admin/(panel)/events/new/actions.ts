'use server'

import { requireAdmin, logAdminAction } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { eventSchema, tiersSchema, type EventInput, type TierInput } from '@/lib/validation/schemas'
import { fromZonedTime } from 'date-fns-tz'

const TZ = 'America/Montevideo'

function toUTC(localDatetime: string): string {
  return fromZonedTime(new Date(localDatetime), TZ).toISOString()
}

export async function createEventAction(
  eventData: EventInput,
  tiers: TierInput[]
): Promise<{ error: string } | { id: string }> {
  const admin = await requireAdmin().catch(() => null)
  if (!admin) return { error: 'No autorizado. Volvé a iniciar sesión.' }

  const eventParsed = eventSchema.safeParse(eventData)
  if (!eventParsed.success) {
    return { error: eventParsed.error.issues[0].message }
  }

  const tiersParsed = tiersSchema.safeParse(tiers)
  if (!tiersParsed.success) {
    return { error: tiersParsed.error.issues[0].message }
  }

  const tierNames = tiersParsed.data.map((t) => t.name.toLowerCase().trim())
  if (tierNames.length !== new Set(tierNames).size) {
    return { error: 'No puede haber dos tiers con el mismo nombre.' }
  }

  const db = createAdminClient()

  const { data: event, error: eventError } = await db
    .from('events')
    .insert({
      ...eventParsed.data,
      location_url: eventParsed.data.location_url || null,
      description_md: eventParsed.data.description_md || null,
      date_start: toUTC(eventParsed.data.date_start),
      date_end: toUTC(eventParsed.data.date_end),
    })
    .select('id')
    .single()

  if (eventError) {
    if (eventError.code === '23505') return { error: 'El slug ya está en uso. Elegí otro.' }
    return { error: 'Error al crear el evento. Intentá de nuevo.' }
  }

  const tiersToInsert = tiersParsed.data.map((tier, i) => ({
    ...tier,
    description: tier.description || null,
    event_id: event.id,
    sort_order: i + 1,
  }))

  const { error: tiersError } = await db.from('ticket_tiers').insert(tiersToInsert)
  if (tiersError) {
    if (tiersError.code === '23505') return { error: 'No puede haber dos tiers con el mismo nombre.' }
    return { error: 'Evento creado pero error al guardar los tiers.' }
  }

  await logAdminAction(admin.id, 'create', 'event', event.id)

  return { id: event.id }
}
