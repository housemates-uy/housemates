'use server';

// Códigos de descuento de un evento. Crear, prender/apagar y eliminar: solo owners.
// Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Códigos de descuento".
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { normalizeCode } from '@/lib/discounts';
import { toUTC } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';

export type CodeFormState = { error: string; field?: string } | { ok: true; code: string } | null;

const schema = z
  .object({
    code: z
      .string()
      .transform(normalizeCode)
      .refine((v) => /^[A-Z0-9_-]{3,30}$/.test(v), 'Entre 3 y 30 letras o números, sin espacios'),
    kind: z.enum(['percent', 'fixed']),
    value: z.coerce.number().positive('Tiene que ser mayor a 0'),
    max_uses: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Un número entero mayor a 0, o vacío'),
    valid_until: z.string().optional(),
  })
  // Un 100 % dejaría la entrada en $0: para eso están las invitaciones.
  .refine((d) => d.kind !== 'percent' || d.value < 100, { message: 'Hasta 99 %. Para gratis, usá una invitación', path: ['value'] });

export async function createDiscountCodeAction(
  eventId: string,
  _prev: CodeFormState,
  formData: FormData,
): Promise<CodeFormState> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden crear códigos.' };

  const parsed = schema.safeParse({
    code: formData.get('code') ?? '',
    kind: formData.get('kind'),
    value: formData.get('value'),
    max_uses: formData.get('max_uses') || undefined,
    valid_until: formData.get('valid_until') || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const d = parsed.data;

  const { data, error } = await createAdminClient()
    .from('discount_codes')
    .insert({
      event_id: eventId,
      code: d.code,
      kind: d.kind,
      value: d.value,
      max_uses: d.max_uses,
      valid_until: d.valid_until ? toUTC(d.valid_until) : null,
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'Ya hay un código con ese nombre en este evento.', field: 'code' };
    return { error: 'No se pudo crear el código. Probá de nuevo.' };
  }

  await logAdminAction(admin.id, 'create_discount_code', 'discount_code', data.id);
  // La lista la refresca el formulario (router.refresh): revalidar desde acá volvía a montar
  // el formulario y se perdía el mensaje de "creado".
  return { ok: true, code: d.code };
}

export async function toggleDiscountCodeAction(eventId: string, codeId: string, active: boolean): Promise<void> {
  const admin = await requireOwner();
  await createAdminClient().from('discount_codes').update({ active }).eq('id', codeId).eq('event_id', eventId);
  await logAdminAction(admin.id, active ? 'enable_discount_code' : 'disable_discount_code', 'discount_code', codeId);
  revalidatePath(`/admin/events/${eventId}/descuentos`);
}

// Solo un código que ninguna entrada usó, de ningún estado: la FK es SET NULL y borrarlo dejaría
// entradas sin saber con qué código se compraron (admin_delete_discount_code, migración 0025).
export async function deleteDiscountCodeAction(eventId: string, codeId: string): Promise<{ error: string } | void> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden eliminar códigos.' };
  const db = createAdminClient();
  const { data: code } = await db.from('discount_codes').select('code').eq('id', codeId).maybeSingle();
  const { data: result, error } = await db.rpc('admin_delete_discount_code', { p_code_id: codeId, p_event_id: eventId });
  if (error) return { error: 'No se pudo eliminar el código. Probá de nuevo.' };
  if (result === 'in_use') return { error: 'El código ya se usó: no se puede eliminar. Pausalo.' };
  if (result === 'deleted') {
    await logAdminAction(admin.id, 'delete_discount_code', 'discount_code', codeId, { deleted: code?.code ?? null });
  }
  revalidatePath(`/admin/events/${eventId}/descuentos`);
}
