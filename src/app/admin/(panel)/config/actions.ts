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

// Configuración de la venta: contraseña para comprar, medios de pago y datos para transferir.
// Ver src/lib/sale-config.ts y docs/LOGICA_DE_NEGOCIO.md → "Compra web".
export type SaleConfigState = { error: string } | { ok: true } | null

export async function saveSaleConfigAction(
  _prev: SaleConfigState,
  formData: FormData
): Promise<SaleConfigState> {
  const admin = await requireOwner().catch(() => null)
  if (!admin) return { error: 'Solo los owners pueden cambiar la venta.' }

  const transferDetails = String(formData.get('transfer_details') ?? '').trim().slice(0, 1000)
  const transferOn = formData.get('pay_transfer_enabled') === 'on'
  if (transferOn && !transferDetails) {
    return { error: 'Para activar la transferencia cargá los datos de la cuenta.' }
  }

  const now = new Date().toISOString()
  const rows = [
    { key: 'gate_enabled', value: formData.get('gate_enabled') === 'on' ? '1' : '0' },
    { key: 'pay_mp_enabled', value: formData.get('pay_mp_enabled') === 'on' ? '1' : '0' },
    { key: 'pay_transfer_enabled', value: transferOn ? '1' : '0' },
    { key: 'transfer_details', value: transferDetails },
  ].map((r) => ({ ...r, updated_by: admin.id, updated_at: now }))

  const { error } = await createAdminClient().from('site_config').upsert(rows, { onConflict: 'key' })
  if (error) return { error: 'Error al guardar. Intentá de nuevo.' }

  await logAdminAction(admin.id, 'update', 'site_config', undefined, {
    gate_enabled: rows[0].value,
    pay_mp_enabled: rows[1].value,
    pay_transfer_enabled: rows[2].value,
  })
  revalidatePath('/admin/config')
  revalidatePath('/entradas')
  return { ok: true }
}
