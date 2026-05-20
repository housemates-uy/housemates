'use server'

import { requireAdmin, requireOwner, logAdminAction } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { eventSchema, tiersSchema, tierEditSchema, type EventInput, type TierInput, type TierEditInput } from '@/lib/validation/schemas'
import { fromZonedTime } from 'date-fns-tz'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const TZ = 'America/Montevideo'

function toUTC(localDatetime: string): string {
  return fromZonedTime(new Date(localDatetime), TZ).toISOString()
}

export async function updateEventAction(
  id: string,
  eventData: EventInput,
  newTiers: TierInput[]
): Promise<{ error: string } | void> {
  const admin = await requireAdmin()

  const eventParsed = eventSchema.safeParse(eventData)
  if (!eventParsed.success) return { error: eventParsed.error.issues[0].message }

  const db = createAdminClient()

  const { error: updateError } = await db
    .from('events')
    .update({
      ...eventParsed.data,
      location_url: eventParsed.data.location_url || null,
      description_md: eventParsed.data.description_md || null,
      date_start: toUTC(eventParsed.data.date_start),
      date_end: toUTC(eventParsed.data.date_end),
    })
    .eq('id', id)

  if (updateError) {
    if (updateError.code === '23505') return { error: 'El slug ya está en uso. Elegí otro.' }
    return { error: 'Error al actualizar el evento.' }
  }

  if (newTiers.length > 0) {
    const tiersParsed = tiersSchema.safeParse(newTiers)
    if (!tiersParsed.success) return { error: tiersParsed.error.issues[0].message }

    const newNames = tiersParsed.data.map((t) => t.name.toLowerCase().trim())
    if (newNames.length !== new Set(newNames).size) {
      return { error: 'No puede haber dos tiers con el mismo nombre.' }
    }

    const { data: existingTiers } = await db
      .from('ticket_tiers')
      .select('name, sort_order')
      .eq('event_id', id)
      .order('sort_order', { ascending: false })

    const existingNames = new Set(existingTiers?.map((t) => t.name.toLowerCase().trim()) ?? [])
    const conflict = newNames.find((n) => existingNames.has(n))
    if (conflict) {
      return { error: `Ya existe un tier con ese nombre en este evento.` }
    }

    const nextOrder = (existingTiers?.[0]?.sort_order ?? 0) + 1

    const { error: tiersError } = await db.from('ticket_tiers').insert(
      tiersParsed.data.map((t, i) => ({
        ...t,
        description: t.description || null,
        event_id: id,
        sort_order: nextOrder + i,
      }))
    )
    if (tiersError) {
      if (tiersError.code === '23505') return { error: 'Ya existe un tier con ese nombre en este evento.' }
      return { error: 'Error al guardar los tiers.' }
    }
  }

  await logAdminAction(admin.id, 'update', 'event', id)
  revalidatePath(`/admin/events/${id}`)
  revalidatePath(`/admin/events/${id}/edit`)
  redirect(`/admin/events/${id}`)
}

export async function updateTierAction(
  tierId: string,
  eventId: string,
  data: TierEditInput
): Promise<{ error: string } | void> {
  const admin = await requireAdmin()

  const parsed = tierEditSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const db = createAdminClient()

  const { data: conflict } = await db
    .from('ticket_tiers')
    .select('id')
    .eq('event_id', eventId)
    .neq('id', tierId)
    .ilike('name', parsed.data.name.trim())
    .maybeSingle()

  if (conflict) return { error: 'Ya existe un tier con ese nombre en este evento.' }

  const { error } = await db
    .from('ticket_tiers')
    .update({
      name: parsed.data.name,
      price_uyu: parsed.data.price_uyu,
      quantity_total: parsed.data.quantity_total,
      description: parsed.data.description || null,
      active: parsed.data.active,
    })
    .eq('id', tierId)

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un tier con ese nombre en este evento.' }
    return { error: 'Error al guardar el tier.' }
  }

  await logAdminAction(admin.id, 'update', 'tier', tierId)
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/edit`)
}

export async function toggleTierActiveAction(
  tierId: string,
  eventId: string,
  current: boolean
): Promise<void> {
  const admin = await requireAdmin()
  const db = createAdminClient()
  await db.from('ticket_tiers').update({ active: !current }).eq('id', tierId)
  await logAdminAction(admin.id, !current ? 'activate_tier' : 'deactivate_tier', 'tier', tierId)
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/edit`)
}

export async function toggleTierSoldOutAction(
  tierId: string,
  eventId: string,
  current: boolean
): Promise<void> {
  const admin = await requireAdmin()
  const db = createAdminClient()
  await db.from('ticket_tiers').update({ sold_out_override: !current }).eq('id', tierId)
  await logAdminAction(admin.id, !current ? 'soldout_tier' : 'restore_tier', 'tier', tierId)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function toggleSalesAction(id: string, current: boolean): Promise<void> {
  const admin = await requireAdmin()
  const db = createAdminClient()
  await db.from('events').update({ sales_active: !current }).eq('id', id)
  await logAdminAction(admin.id, !current ? 'enable_sales' : 'disable_sales', 'event', id)
  revalidatePath(`/admin/events/${id}`)
}

export async function archiveEventAction(id: string): Promise<void> {
  const admin = await requireOwner()
  const db = createAdminClient()
  await db.from('events').update({ status: 'archived', sales_active: false }).eq('id', id)
  await logAdminAction(admin.id, 'archive', 'event', id)
  redirect('/admin/events')
}
