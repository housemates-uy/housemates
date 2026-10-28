'use server'

import { requireAdmin, logAdminAction } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { eventSchema, tiersSchema, type EventInput, type TierInput } from '@/lib/validation/schemas'
import { tierExtrasToDb, toUTC } from '@/lib/events'

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
  if (eventParsed.data.status === 'archived' && admin.role !== 'owner') {
    return { error: 'Solo los owners pueden archivar un evento.' }
  }

  const tiersParsed = tiersSchema.safeParse(tiers)
  if (!tiersParsed.success) {
    return { error: tiersParsed.error.issues[0].message }
  }

  const tierNames = tiersParsed.data.map((t) => t.name.toLowerCase().trim())
  if (tierNames.length !== new Set(tierNames).size) {
    return { error: 'No puede haber dos tandas con el mismo nombre.' }
  }
  const presaleCodes = tiersParsed.data.map((t) => t.presale_code).filter(Boolean)
  if (presaleCodes.length !== new Set(presaleCodes).size) {
    return { error: 'No puede haber dos tandas con el mismo código de preventa.' }
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
    ...tierExtrasToDb(tier),
    description: tier.description || null,
    event_id: event.id,
    sort_order: i + 1,
  }))

  // Si las tandas no entran, se borra el evento recién creado (todavía no tiene nada colgado):
  // así no queda un evento a medias y se puede volver a intentar con el mismo slug.
  const { error: tiersError } = await db.from('ticket_tiers').insert(tiersToInsert)
  if (tiersError) {
    const { error: rollbackError } = await db.from('events').delete().eq('id', event.id)
    if (rollbackError) {
      return { error: 'Se creó el evento pero no sus tandas. Entrá al evento y agregalas desde Editar.' }
    }
    if (tiersError.message.includes('presale_code')) {
      return { error: 'Ese código de preventa no es válido o está repetido. No se creó el evento.' }
    }
    if (tiersError.code === '23505') return { error: 'No puede haber dos tandas con el mismo nombre. No se creó el evento.' }
    return { error: 'No se pudieron guardar las tandas, así que no se creó el evento. Probá de nuevo.' }
  }

  await logAdminAction(admin.id, 'create', 'event', event.id, {
    title: eventParsed.data.title,
    status: eventParsed.data.status,
    tiers: tiersParsed.data.map((t) => t.name),
  })

  return { id: event.id }
}
