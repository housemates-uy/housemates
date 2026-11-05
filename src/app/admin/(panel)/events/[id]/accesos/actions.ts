'use server';

// Códigos de acceso para comprar. Crear, pausar/activar y eliminar: solo owners.
// Reglas: ver docs/LOGICA_DE_NEGOCIO.md → §3b.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { ACCESS_KIND_LABELS, formatAccessCode, generateAccessCode } from '@/lib/access-codes';
import { toUTC } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';

export type AccessFormState = { error: string; field?: string } | { ok: true; code: string } | null;

const maxUses = z.coerce
  .number({ invalid_type_error: 'Un número entero entre 1 y 1000' })
  .int('Un número entero entre 1 y 1000')
  .min(1, 'Al menos 1')
  .max(1000, 'Hasta 1000');

// Personal: para una persona y sus amigos, con X entradas. Público (historias de Instagram):
// cada compra lleva una sola entrada; el total es opcional (vacío = sin tope).
const schema = z.object({
  kind: z.enum(['personal', 'public']),
  label: z.string().trim().min(1, 'Poné para quién es').max(120, 'Hasta 120 caracteres'),
  max_uses: maxUses.nullable(),
  valid_until: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), 'Fecha y hora inválidas')
    .transform((v) => (v ? toUTC(v) : null))
    .refine((v) => !v || new Date(v).getTime() > Date.now(), 'Esa fecha ya pasó'),
});

export async function createAccessCodeAction(eventId: string, formData: FormData): Promise<AccessFormState> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden crear códigos de acceso.' };

  const kind = formData.get('kind') === 'public' ? 'public' : 'personal';
  const rawMax = String(formData.get('max_uses') ?? '').trim();
  const parsed = schema.safeParse({
    kind,
    label: formData.get('label') ?? '',
    // Un personal siempre lleva cuántas entradas (vacío no pasa); un público vacío es sin tope.
    max_uses: kind === 'public' && rawMax === '' ? null : rawMax,
    valid_until: formData.get('valid_until') || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const d = parsed.data;
  const db = createAdminClient();

  // El código es único entre todos los eventos: si sale uno que ya existe, se sortea otro.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAccessCode();
    const { data, error } = await db
      .from('access_codes')
      .insert({
        event_id: eventId,
        code,
        kind: d.kind,
        label: d.label,
        max_uses: d.max_uses,
        valid_until: d.valid_until,
        created_by_admin_id: admin.id,
      })
      .select('id')
      .single();
    if (!error) {
      await logAdminAction(admin.id, 'create_access_code', 'access_code', data.id, {
        kind: ACCESS_KIND_LABELS[d.kind],
        label: d.label,
        max_uses: d.max_uses ?? 'Sin tope',
        valid_until: d.valid_until,
      });
      return { ok: true, code };
    }
    if (error.code !== '23505') break;
  }
  return { error: 'No se pudo crear el código. Probá de nuevo.' };
}

export async function toggleAccessCodeAction(eventId: string, codeId: string, active: boolean): Promise<void> {
  const admin = await requireOwner();
  await createAdminClient().from('access_codes').update({ active }).eq('id', codeId).eq('event_id', eventId);
  await logAdminAction(admin.id, active ? 'enable_access_code' : 'disable_access_code', 'access_code', codeId);
  revalidatePath(`/admin/events/${eventId}/accesos`);
}

// Solo un código que ninguna entrada usó, de ningún estado (la FK de tickets no deja borrarlo);
// si se usó, se pausa.
export async function deleteAccessCodeAction(eventId: string, codeId: string): Promise<{ error: string } | void> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden eliminar códigos de acceso.' };
  const { data, error } = await createAdminClient()
    .from('access_codes')
    .delete()
    .eq('id', codeId)
    .eq('event_id', eventId)
    .select('code, label');
  if (error) {
    if (error.code === '23503') return { error: 'El código ya se usó: no se puede eliminar. Pausalo.' };
    return { error: 'No se pudo eliminar el código. Probá de nuevo.' };
  }
  if (data[0]) {
    await logAdminAction(admin.id, 'delete_access_code', 'access_code', codeId, {
      deleted: `${formatAccessCode(data[0].code)} · para ${data[0].label}`,
    });
  }
  revalidatePath(`/admin/events/${eventId}/accesos`);
}
