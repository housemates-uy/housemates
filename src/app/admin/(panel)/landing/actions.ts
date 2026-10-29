'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fieldChanges, logAdminAction, requireOwner } from '@/lib/auth/admin'
import { LANDING_KEYS, LANDING_LIMITS, landingFromConfig, landingToConfig } from '@/lib/landing'
import { DEFAULT_IG_HANDLE } from '@/lib/site'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeInstagram } from '@/lib/tickets'

// Textos de la landing e Instagram del sitio. Ver src/lib/landing.ts y
// docs/LOGICA_DE_NEGOCIO.md → "Landing".
export type LandingFormState = { error: string; field?: string } | null

const line = (label: string, max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .refine((v) => v.length > 0, `Completá ${label}.`)
    .refine((v) => v.length <= max, `${label[0].toUpperCase()}${label.slice(1)}: máximo ${max} caracteres.`)

const landingSchema = z.object({
  heroTitle: line('el título de la portada', LANDING_LIMITS.heroTitle),
  houseTitle: line('el título de La casa', LANDING_LIMITS.houseTitle),
  houseText: z
    .string()
    .transform((v) => v.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    .refine((v) => v.length > 0, 'Completá el texto de La casa.')
    .refine((v) => v.length <= LANDING_LIMITS.houseText, `Texto de La casa: máximo ${LANDING_LIMITS.houseText} caracteres.`),
  houseCredits: z
    .string()
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .refine((v) => v.length <= LANDING_LIMITS.houseCredits, `Créditos: máximo ${LANDING_LIMITS.houseCredits} caracteres.`),
  rulesTitle: line('el título de las reglas', LANDING_LIMITS.rulesTitle),
  rules: z
    .array(z.string().transform((v) => v.replace(/\s+/g, ' ').trim()))
    .transform((rules) => rules.filter(Boolean))
    .refine((rules) => rules.length > 0, 'Dejá al menos una regla.')
    .refine((rules) => rules.length <= LANDING_LIMITS.rules, `Hasta ${LANDING_LIMITS.rules} reglas.`)
    .refine(
      (rules) => rules.every((r) => r.length <= LANDING_LIMITS.rule),
      `Cada regla: máximo ${LANDING_LIMITS.rule} caracteres.`,
    ),
  // Mismo criterio que el Instagram de las entradas (buyerSchema en src/lib/tickets.ts).
  igHandle: z
    .string()
    .transform(normalizeInstagram)
    .refine((v) => v.length > 0, 'Completá el usuario de Instagram.')
    .refine((v) => /^[a-z0-9._]{1,30}$/.test(v), 'Usuario de Instagram inválido: solo letras, números, puntos y guiones bajos (hasta 30).'),
})

const FIELD_OF: Record<string, string> = {
  heroTitle: 'hero_title',
  houseTitle: 'house_title',
  houseText: 'house_text',
  houseCredits: 'house_credits',
  rulesTitle: 'rules_title',
  rules: 'rules',
  igHandle: 'ig_handle',
}

export async function saveLandingAction(_prev: LandingFormState, formData: FormData): Promise<LandingFormState> {
  const admin = await requireOwner().catch(() => null)
  if (!admin) return { error: 'Solo los owners pueden cambiar la landing.' }

  const parsed = landingSchema.safeParse({
    heroTitle: String(formData.get('hero_title') ?? ''),
    houseTitle: String(formData.get('house_title') ?? ''),
    houseText: String(formData.get('house_text') ?? ''),
    houseCredits: String(formData.get('house_credits') ?? ''),
    rulesTitle: String(formData.get('rules_title') ?? ''),
    rules: formData.getAll('rule').map(String),
    igHandle: String(formData.get('ig_handle') ?? ''),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue.message, field: FIELD_OF[String(issue.path[0])] }
  }
  const { igHandle, ...content } = parsed.data

  const db = createAdminClient()
  const { data: current, error: readError } = await db
    .from('site_config')
    .select('key, value')
    .in('key', [...Object.values(LANDING_KEYS), 'ig_handle'])
  if (readError) return { error: 'Error al guardar. Intentá de nuevo.' }
  const stored = new Map((current ?? []).map((r) => [r.key, r.value]))

  // Antes = lo que se veía (el texto de siempre si la clave no estaba): así el Historial no
  // anota como cambio un campo que quedó igual.
  const before = {
    ...landingToConfig(landingFromConfig(stored)),
    ig_handle: stored.get('ig_handle') || DEFAULT_IG_HANDLE,
  }
  const after = { ...landingToConfig(content), ig_handle: `@${igHandle}` }
  const changes = fieldChanges(before, after)

  if (Object.keys(changes).length > 0) {
    const now = new Date().toISOString()
    const rows = Object.keys(changes).map((key) => ({
      key,
      value: after[key as keyof typeof after],
      updated_by: admin.id,
      updated_at: now,
    }))
    const { error } = await db.from('site_config').upsert(rows, { onConflict: 'key' })
    if (error) return { error: 'Error al guardar. Intentá de nuevo.' }

    await logAdminAction(admin.id, 'update_landing', 'site_config', undefined, { changes })
    // El Instagram sale en todo el sitio (menú, pie, ayuda, legales): se revalida todo.
    revalidatePath('/', 'layout')
  }
  // "Guardado." viaja en la URL: el loading.tsx raíz vuelve a montar la página y un estado
  // local se perdería.
  redirect('/admin/landing?guardada=1')
}
