'use server'

import { requireAdmin, requireOwner, logAdminAction, fieldChanges } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { eventSchema, tiersSchema, tierEditSchema, type EventInput, type TierInput, type TierEditInput } from '@/lib/validation/schemas'
import { tierExtrasToDb, toUTC } from '@/lib/events'
import { presaleBlocker, sendPresaleMails } from '@/lib/mail/presale-mails'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const PRESALE_TAKEN = 'Ese código de preventa ya lo usa otra tanda de este evento.'
const NAME_TAKEN = 'Ya existe una tanda con ese nombre en este evento.'

// Mismo criterio que el índice único ticket_tiers_event_name_unique (event_id, lower(name)).
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export async function updateEventAction(
  id: string,
  eventData: EventInput,
  newTiers: TierInput[]
): Promise<{ error: string } | void> {
  const admin = await requireAdmin()

  const eventParsed = eventSchema.safeParse(eventData)
  if (!eventParsed.success) return { error: eventParsed.error.issues[0].message }

  const db = createAdminClient()

  const { data: before } = await db
    .from('events')
    .select('title, slug, date_start, date_end, location_name, location_url, capacity, status, description_md, sales_active')
    .eq('id', id)
    .single()
  if (!before) return { error: 'No se encontró el evento.' }

  // Archivar y desarchivar es de los owners, igual que el botón "Archivar" del resumen.
  const status = eventParsed.data.status
  if (admin.role !== 'owner' && status !== before.status && (status === 'archived' || before.status === 'archived')) {
    return { error: 'Solo los owners pueden archivar o desarchivar un evento.' }
  }

  // Las tandas nuevas se validan antes de tocar el evento, así un error no deja la mitad guardada.
  let tiersToInsert: TierInput[] = []
  if (newTiers.length > 0) {
    const tiersParsed = tiersSchema.safeParse(newTiers)
    if (!tiersParsed.success) return { error: tiersParsed.error.issues[0].message }

    const names = tiersParsed.data.map((t) => t.name)
    if (names.some((n, i) => names.findIndex((m) => sameName(m, n)) !== i)) {
      return { error: 'No puede haber dos tandas con el mismo nombre.' }
    }
    const codes = tiersParsed.data.map((t) => t.presale_code).filter(Boolean)
    if (codes.length !== new Set(codes).size) {
      return { error: 'No puede haber dos tandas con el mismo código de preventa.' }
    }

    const { data: existing } = await db.from('ticket_tiers').select('name').eq('event_id', id)
    if (names.some((n) => (existing ?? []).some((t) => sameName(t.name, n)))) return { error: NAME_TAKEN }
    tiersToInsert = tiersParsed.data
  }

  const after = {
    ...eventParsed.data,
    location_url: eventParsed.data.location_url || null,
    description_md: eventParsed.data.description_md || null,
    date_start: toUTC(eventParsed.data.date_start),
    date_end: toUTC(eventParsed.data.date_end),
    // Un evento archivado no vende (como archiveEventAction).
    ...(status === 'archived' ? { sales_active: false } : {}),
  }

  const { error: updateError } = await db.from('events').update(after).eq('id', id)

  if (updateError) {
    if (updateError.code === '23505') return { error: 'El slug ya está en uso. Elegí otro.' }
    return { error: 'Error al actualizar el evento.' }
  }

  if (tiersToInsert.length > 0) {
    const { data: last } = await db
      .from('ticket_tiers')
      .select('sort_order')
      .eq('event_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = (last?.sort_order ?? 0) + 1

    const { error: tiersError } = await db.from('ticket_tiers').insert(
      tiersToInsert.map((t, i) => ({
        ...t,
        ...tierExtrasToDb(t),
        description: t.description || null,
        event_id: id,
        sort_order: nextOrder + i,
      }))
    )
    if (tiersError) {
      if (tiersError.message.includes('presale_code')) return { error: PRESALE_TAKEN }
      if (tiersError.code === '23505') return { error: NAME_TAKEN }
      return { error: 'Se guardó el evento, pero no las tandas nuevas. Probá de nuevo.' }
    }
  }

  await logAdminAction(admin.id, 'update', 'event', id, {
    changes: fieldChanges(before, after),
    ...(tiersToInsert.length > 0 ? { new_tiers: tiersToInsert.map((t) => t.name) } : {}),
  })
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

  const [{ data: before }, { data: siblings }] = await Promise.all([
    db
      .from('ticket_tiers')
      .select('name, price_uyu, quantity_total, quantity_sold, description, active, entry_until, sales_start, presale_code')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single(),
    db.from('ticket_tiers').select('name').eq('event_id', eventId).neq('id', tierId),
  ])
  if (!before) return { error: 'No se encontró la tanda.' }
  if ((siblings ?? []).some((t) => sameName(t.name, parsed.data.name))) return { error: NAME_TAKEN }

  const total = parsed.data.quantity_total
  const soldMessage = (sold: number) =>
    `Ya se ${sold === 1 ? 'vendió 1 entrada' : `vendieron ${sold} entradas`} de esta tanda: el cupo no puede ser menor.`
  if (total < before.quantity_sold) return { error: soldMessage(before.quantity_sold) }

  const after = {
    name: parsed.data.name,
    price_uyu: parsed.data.price_uyu,
    quantity_total: total,
    description: parsed.data.description || null,
    active: parsed.data.active,
    ...tierExtrasToDb(parsed.data),
  }

  // El cupo se valida en el mismo UPDATE: si entre la lectura y el guardado se vendió otra,
  // no se guarda un cupo menor a lo vendido.
  const { data: saved, error } = await db
    .from('ticket_tiers')
    .update(after)
    .eq('id', tierId)
    .lte('quantity_sold', total)
    .select('id')

  if (error) {
    if (error.message.includes('presale_code')) return { error: PRESALE_TAKEN }
    if (error.code === '23505') return { error: NAME_TAKEN }
    return { error: 'Error al guardar la tanda.' }
  }
  if (saved.length === 0) {
    const { data: now } = await db.from('ticket_tiers').select('quantity_sold').eq('id', tierId).single()
    return { error: soldMessage(now?.quantity_sold ?? total + 1) }
  }

  await logAdminAction(admin.id, 'update', 'tier', tierId, { changes: fieldChanges(before, after) })
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

// "Mandar preventa a quienes vinieron antes" (solo owners). Manda hasta 45 s por clic (la
// página exporta maxDuration = 60); si quedan pendientes, salen con el próximo clic.
// Solo si el link deja comprar: evento publicado con ventas activas y tanda activa, sin
// agotado manual, ya a la venta y con lugar (presaleBlocker). Si no, la página dice por qué.
export async function sendPresaleAction(eventId: string, tierId: string): Promise<void> {
  const admin = await requireOwner()
  if (await presaleBlocker(tierId)) {
    redirect(`/admin/events/${eventId}?${new URLSearchParams({ preventa: tierId, p_bloqueada: '1', t: String(Date.now()) })}#preventa`)
  }
  const r = await sendPresaleMails(tierId, { budgetMs: 45_000, adminId: admin.id })
  await logAdminAction(admin.id, 'send_presale', 'tier', tierId, r)
  const q = new URLSearchParams({
    preventa: tierId,
    p_ok: String(r.sent),
    p_fallaron: String(r.failed),
    p_quedan: String(r.left),
    t: String(Date.now()),
  })
  if (r.skipped > 0) q.set('p_salteados', String(r.skipped))
  redirect(`/admin/events/${eventId}?${q}#preventa`)
}
