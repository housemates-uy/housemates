'use server'

import { requireOwner, logAdminAction, fieldChanges } from '@/lib/auth/admin'
import { MAX_PER_ORDER_LIMIT } from '@/lib/sale-config'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Sin espacios al principio ni al final: quien la copia de un mensaje suele arrastrar uno, y
// /api/gate también recorta lo que escribe la persona.
const passwordSchema = z.string().trim().min(6, 'Mínimo 6 caracteres')

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

  // Sin la contraseña en el detalle. entity_id es uuid: la clave va en la acción.
  await logAdminAction(admin.id, 'update_gate_password', 'site_config')

  revalidatePath('/admin/config')
  return { ok: true }
}

// Configuración de la venta: contraseña para comprar, medios de pago, datos para transferir y
// máximo de entradas por compra.
// Ver src/lib/sale-config.ts y docs/LOGICA_DE_NEGOCIO.md → "Compra web".
export type SaleConfigState = { error: string } | null

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
  const maxPerOrder = Number(formData.get('max_tickets_per_order'))
  if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > MAX_PER_ORDER_LIMIT) {
    return { error: `El máximo de entradas por compra tiene que ser un número entero de 1 a ${MAX_PER_ORDER_LIMIT}.` }
  }

  const db = createAdminClient()
  const { data: current } = await db
    .from('site_config')
    .select('key, value')
    .in('key', ['gate_enabled', 'pay_mp_enabled', 'pay_transfer_enabled', 'transfer_details', 'max_tickets_per_order'])
  const before = Object.fromEntries((current ?? []).map((r) => [r.key, r.value]))

  const now = new Date().toISOString()
  const rows = [
    { key: 'gate_enabled', value: formData.get('gate_enabled') === 'on' ? '1' : '0' },
    { key: 'pay_mp_enabled', value: formData.get('pay_mp_enabled') === 'on' ? '1' : '0' },
    { key: 'pay_transfer_enabled', value: transferOn ? '1' : '0' },
    { key: 'transfer_details', value: transferDetails },
    { key: 'max_tickets_per_order', value: String(maxPerOrder) },
  ].map((r) => ({ ...r, updated_by: admin.id, updated_at: now }))

  const { error } = await db.from('site_config').upsert(rows, { onConflict: 'key' })
  if (error) return { error: 'Error al guardar. Intentá de nuevo.' }

  // Antes y después de lo que cambió, incluidos los datos para transferir: si alguien cambia
  // la cuenta a la que se transfiere, queda registrado quién y qué había antes.
  const changes = fieldChanges(before, Object.fromEntries(rows.map((r) => [r.key, r.value])))
  if (Object.keys(changes).length > 0) {
    await logAdminAction(admin.id, 'update_sale_config', 'site_config', undefined, { changes })
  }
  revalidatePath('/admin/config')
  revalidatePath('/entradas')
  // "Guardado." viaja en la URL: con useFormState, el estado se pierde cuando la acción
  // revalida la página.
  redirect('/admin/config?venta=guardada')
}

// "Mi cuenta" para el público (ver isAccountsEnabled en src/lib/customers.ts). Al cambiarla se
// rearma todo el sitio: los textos y el link de la cuenta salen o vuelven en todas las páginas.
export async function setAccountsEnabledAction(formData: FormData): Promise<void> {
  const admin = await requireOwner()
  const value = formData.get('enabled') === '1' ? '1' : '0'

  const db = createAdminClient()
  const { data: current } = await db.from('site_config').select('value').eq('key', 'accounts_enabled').maybeSingle()
  const before = current?.value === '1' ? '1' : '0'

  const { error } = await db
    .from('site_config')
    .upsert(
      { key: 'accounts_enabled', value, updated_by: admin.id, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) redirect('/admin/config?cuenta=error')

  if (before !== value) {
    await logAdminAction(admin.id, 'update_sale_config', 'site_config', undefined, {
      changes: fieldChanges({ accounts_enabled: before }, { accounts_enabled: value }),
    })
  }
  revalidatePath('/', 'layout')
  redirect(`/admin/config?cuenta=${value === '1' ? 'prendida' : 'apagada'}`)
}
