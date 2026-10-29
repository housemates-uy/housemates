'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { logAdminAction, requireOwner } from '@/lib/auth/admin'
import {
  LANDING_BUCKET,
  LANDING_MEDIA_DEFAULTS,
  LANDING_MEDIA_KEY,
  MEDIA_LABELS,
  MEDIA_LIMITS,
  MEDIA_SLOTS,
  MEDIA_TYPES,
  bucketPath,
  bucketUrl,
  isBucketPathFor,
  isOriginalMedia,
  mediaFileError,
  mediaFileName,
  parseMediaOverrides,
  typeOfPath,
  type LandingMedia,
  type LandingMediaOverrides,
  type MediaSlot,
} from '@/lib/landing'
import { createAdminClient } from '@/lib/supabase/admin'

// Fotos y videos de la landing. El archivo no pasa por acá (Vercel corta en 4,5 MB): el
// navegador pide un link firmado, sube directo a Storage y después guarda.
// Ver src/lib/landing.ts y docs/LOGICA_DE_NEGOCIO.md → "Landing".
export type MediaActionResult = { ok: true } | { error: string }
export type UploadRequest = { name: string; type: string; size: number }
export type UploadTicket = { path: string; token: string }
export type UploadedMedia = { path: string; posterPath?: string; width?: number; height?: number }

const NOT_OWNER = { error: 'Solo los owners pueden cambiar la landing.' }
const INVALID = { error: 'Pedido inválido. Recargá la página e intentá de nuevo.' }

const isSlot = (value: unknown): value is MediaSlot => MEDIA_SLOTS.includes(value as MediaSlot)

function safeName(name: string): string {
  const base = name
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return base || 'archivo'
}

export async function createLandingUploadAction(
  slot: MediaSlot,
  files: UploadRequest[],
): Promise<{ uploads: UploadTicket[] } | { error: string }> {
  const admin = await requireOwner().catch(() => null)
  if (!admin) return NOT_OWNER
  if (!isSlot(slot) || !Array.isArray(files) || files.length < 1 || files.length > 2) return INVALID

  const [file, poster] = files
  const fileError = mediaFileError(file.type, file.size)
  if (fileError) return { error: fileError }
  const type = MEDIA_TYPES[file.type].type
  // Un video lleva su imagen fija (la saca el navegador del primer cuadro); una foto, nada.
  if (type === 'image' && poster) return INVALID
  if (type === 'video' && (!poster || MEDIA_TYPES[poster.type]?.type !== 'image' || mediaFileError(poster.type, poster.size))) {
    return { error: 'No se pudo sacar la imagen del video. Probá con otro video (MP4).' }
  }

  const base = `${slot}/${randomBytes(4).toString('hex')}-${safeName(file.name)}`
  const paths = [`${base}.${MEDIA_TYPES[file.type].ext}`]
  if (poster) paths.push(`${base}-poster.${MEDIA_TYPES[poster.type].ext}`)

  const storage = createAdminClient().storage.from(LANDING_BUCKET)
  const uploads: UploadTicket[] = []
  for (const path of paths) {
    const { data, error } = await storage.createSignedUploadUrl(path)
    if (error || !data) return { error: 'No se pudo preparar la subida. Intentá de nuevo.' }
    uploads.push({ path: data.path, token: data.token })
  }
  return { uploads }
}

async function readOverrides(db: ReturnType<typeof createAdminClient>): Promise<LandingMediaOverrides | null> {
  const { data, error } = await db.from('site_config').select('value').eq('key', LANDING_MEDIA_KEY).maybeSingle()
  return error ? null : parseMediaOverrides(data?.value)
}

function referencedPaths(overrides: LandingMediaOverrides): Set<string> {
  const paths = Object.values(overrides).flatMap((m) => [bucketPath(m.src), bucketPath(m.poster)])
  return new Set(paths.filter((p): p is string => !!p))
}

// Borra del bucket lo que no usa ningún lugar (nunca toca public/).
async function removeUnused(db: ReturnType<typeof createAdminClient>, paths: string[], overrides: LandingMediaOverrides) {
  const used = referencedPaths(overrides)
  const unused = paths.filter((p) => MEDIA_SLOTS.some((slot) => isBucketPathFor(slot, p)) && !used.has(p))
  if (unused.length === 0) return
  const { error } = await db.storage.from(LANDING_BUCKET).remove(unused)
  if (error) console.error('[landing] no se pudieron borrar archivos viejos', unused, error.message)
}

// El archivo subido existe y es lo que dice ser (el navegador podría mentir el tipo o el peso).
async function checkUploaded(db: ReturnType<typeof createAdminClient>, slot: MediaSlot, path: string): Promise<boolean> {
  const [folder, name] = path.split('/')
  const { data } = await db.storage.from(LANDING_BUCKET).list(folder, { search: name, limit: 10 })
  const file = data?.find((f) => f.name === name)
  const mimeType = String(file?.metadata?.mimetype ?? '')
  return (
    !!file &&
    isBucketPathFor(slot, path) &&
    MEDIA_TYPES[mimeType]?.type === typeOfPath(path) &&
    !mediaFileError(mimeType, Number(file.metadata?.size ?? 0))
  )
}

const dimension = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 20000 ? value : undefined

function describe(slot: MediaSlot, media: LandingMedia): string {
  const kind = media.type === 'video' ? 'Video' : 'Foto'
  const original = media.src === LANDING_MEDIA_DEFAULTS[slot].src ? ' (la de siempre)' : ''
  return `${kind}: ${mediaFileName(media.src)}${original}`
}

// Cambia el archivo de un lugar (upload), solo su texto alternativo, o lo vuelve al de
// siempre (restore). Lo reemplazado que estaba en el bucket se borra.
export async function saveLandingMediaAction(
  input: { slot: MediaSlot; restore: true } | { slot: MediaSlot; alt: string; upload?: UploadedMedia },
): Promise<MediaActionResult> {
  const admin = await requireOwner().catch(() => null)
  if (!admin) return NOT_OWNER
  if (!isSlot(input?.slot)) return INVALID
  const { slot } = input
  const upload = 'upload' in input ? input.upload : undefined
  const newPaths = upload ? [upload.path, upload.posterPath].filter((p): p is string => !!p) : []

  const db = createAdminClient()
  const overrides = await readOverrides(db)
  if (!overrides) return { error: 'Error al guardar. Intentá de nuevo.' }
  const fail = async (error: string): Promise<MediaActionResult> => {
    await removeUnused(db, newPaths, overrides)
    return { error }
  }

  const current = overrides[slot] ?? LANDING_MEDIA_DEFAULTS[slot]
  let next: LandingMedia
  if ('restore' in input) {
    next = LANDING_MEDIA_DEFAULTS[slot]
  } else {
    // La portada es de fondo: no lleva texto alternativo.
    const alt = slot.startsWith('hero') ? '' : String(input.alt ?? '').replace(/\s+/g, ' ').trim()
    if (!slot.startsWith('hero') && !alt) return fail('Escribí qué se ve (texto alternativo): lo leen los lectores de pantalla.')
    if (alt.length > MEDIA_LIMITS.alt) return fail(`Texto alternativo: máximo ${MEDIA_LIMITS.alt} caracteres.`)

    if (upload) {
      const type = typeOfPath(upload.path)
      const posterOk = type === 'video' ? !!upload.posterPath && typeOfPath(upload.posterPath) === 'image' : !upload.posterPath
      if (!type || !posterOk) return fail(INVALID.error)
      for (const path of newPaths) {
        if (!(await checkUploaded(db, slot, path))) return fail('No encontramos el archivo subido. Intentá de nuevo.')
      }
      next = {
        type,
        src: bucketUrl(upload.path),
        ...(upload.posterPath ? { poster: bucketUrl(upload.posterPath) } : {}),
        alt,
        ...(dimension(upload.width) && dimension(upload.height)
          ? { width: dimension(upload.width), height: dimension(upload.height) }
          : {}),
      }
    } else {
      next = { ...current, alt }
    }
  }

  if (next.src === current.src && next.alt === current.alt) return { ok: true }

  const nextOverrides: LandingMediaOverrides = { ...overrides, [slot]: next }
  if (isOriginalMedia(slot, next)) delete nextOverrides[slot]

  const { error } =
    Object.keys(nextOverrides).length === 0
      ? await db.from('site_config').delete().eq('key', LANDING_MEDIA_KEY)
      : await db.from('site_config').upsert(
          {
            key: LANDING_MEDIA_KEY,
            value: JSON.stringify(nextOverrides),
            updated_by: admin.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' },
        )
  if (error) return fail('Error al guardar. Intentá de nuevo.')

  await removeUnused(db, [bucketPath(current.src), bucketPath(current.poster)].filter((p): p is string => !!p), nextOverrides)

  const changes: Record<string, { from: string; to: string }> = {}
  if (next.src !== current.src) changes.file = { from: describe(slot, current), to: describe(slot, next) }
  if (next.alt !== current.alt) changes.alt = { from: current.alt, to: next.alt }
  await logAdminAction(admin.id, 'update_landing_media', 'site_config', undefined, { slot: MEDIA_LABELS[slot], changes })

  revalidatePath('/')
  revalidatePath('/admin/landing')
  return { ok: true }
}

// Si la subida se corta a la mitad (p. ej. subió el video y no su imagen), el navegador
// pide borrar lo que alcanzó a subir. Solo se borra lo que no usa ningún lugar.
export async function discardLandingUploadsAction(paths: string[]): Promise<void> {
  const admin = await requireOwner().catch(() => null)
  if (!admin || !Array.isArray(paths)) return
  const db = createAdminClient()
  const overrides = await readOverrides(db)
  if (overrides) await removeUnused(db, paths.map(String), overrides)
}
