'use server'

import { requireOwner, logAdminAction } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const passwordSchema = z.string().min(6, 'Mínimo 6 caracteres')

export async function updateGatePasswordAction(
  password: string
): Promise<{ error: string } | { ok: true }> {
  const admin = await requireOwner()

  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const db = createAdminClient()
  const { error } = await db.from('site_config').upsert(
    {
      key: 'gate_password',
      value: parsed.data,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (error) return { error: 'Error al guardar. Intentá de nuevo.' }

  await logAdminAction(admin.id, 'update', 'site_config', 'gate_password')

  revalidatePath('/admin/config')
  return { ok: true }
}
