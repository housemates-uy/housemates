'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { logAdminAction, requireOwner } from '@/lib/auth/admin'
import { formatLocal, slugify, toUTC } from '@/lib/events'
import { createAdminClient } from '@/lib/supabase/admin'

// Copiar un evento a otra fecha: lo que se copia y lo que no está en
// supabase/migrations/0023_duplicate_event.sql.
export type DuplicateFormState = { error: string; field?: string } | null

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const duplicateSchema = z
  .object({
    title: z.string().trim().min(2, 'Título requerido'),
    date_start: z.string().regex(LOCAL_DATETIME, 'Fecha de inicio requerida'),
    date_end: z.string().regex(LOCAL_DATETIME, 'Fecha de fin requerida'),
  })
  .refine((e) => e.date_end > e.date_start, {
    message: 'La fecha de fin tiene que ser posterior al inicio',
    path: ['date_end'],
  })

export async function duplicateEventAction(
  sourceId: string,
  _prev: DuplicateFormState,
  formData: FormData
): Promise<DuplicateFormState> {
  const admin = await requireOwner().catch(() => null)
  if (!admin) return { error: 'Solo los owners pueden copiar eventos.' }

  const parsed = duplicateSchema.safeParse({
    title: String(formData.get('title') ?? ''),
    date_start: String(formData.get('date_start') ?? ''),
    date_end: String(formData.get('date_end') ?? ''),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue.message, field: String(issue.path[0]) }
  }

  const db = createAdminClient()
  const { data: source } = await db.from('events').select('title, date_start').eq('id', sourceId).single()
  if (!source) return { error: 'No se encontró el evento.' }

  const { title } = parsed.data
  const dateStart = toUTC(parsed.data.date_start)
  const dateEnd = toUTC(parsed.data.date_end)

  const { data: id, error } = await db.rpc('duplicate_event', {
    p_source_id: sourceId,
    p_title: title,
    p_slug: slugify(title) || 'evento',
    p_date_start: dateStart,
    p_date_end: dateEnd,
  })
  if (error || !id) return { error: 'No se pudo copiar el evento. Probá de nuevo.' }

  await logAdminAction(admin.id, 'duplicate_event', 'event', id, {
    copied_from: `${source.title} · ${formatLocal(source.date_start, 'd/MM/yyyy')}`,
    copied_from_id: sourceId,
    date_start: dateStart,
    date_end: dateEnd,
  })
  revalidatePath('/admin/events')
  redirect(`/admin/events/${id}/edit?copiado=1`)
}
