'use server';

// Transporte de un evento: opciones de bus (cargar, editar, activar/desactivar, eliminar).
// Todo esto es solo para owners. Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Transporte".
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export type OptionFormState = { error: string; field?: string } | { ok: true; name: string } | null;

const optionSchema = z.object({
  name: z.string().trim().min(1, 'Poné el nombre. Ej: Ida y vuelta').max(60, 'Hasta 60 letras'),
  departure: z
    .string()
    .trim()
    .min(1, 'Poné el punto y el horario de salida')
    .max(300, 'Hasta 300 letras'),
  price: z.coerce
    .number({ invalid_type_error: 'Poné el precio' })
    .int('En pesos, sin centavos')
    .positive('Tiene que ser mayor a 0')
    .max(100000, 'Revisá el precio'),
  capacity: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Un número entero mayor a 0, o vacío'),
});

const transportPath = (eventId: string) => `/admin/events/${eventId}/transporte`;

// Alta (optionId = null) o edición. Cambiar el precio no toca a quienes ya compraron: cada
// entrada guarda el precio del bus del momento.
export async function saveTransportOptionAction(
  eventId: string,
  optionId: string | null,
  formData: FormData,
): Promise<OptionFormState> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden cambiar el transporte.' };

  const parsed = optionSchema.safeParse({
    name: formData.get('name') ?? '',
    departure: formData.get('departure') ?? '',
    price: formData.get('price') || undefined,
    capacity: formData.get('capacity') || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const d = parsed.data;
  const db = createAdminClient();

  // El cupo no puede quedar por debajo de los lugares ya tomados.
  if (optionId && d.capacity !== null) {
    const { data: taken } = await db.rpc('transport_seats_taken', { p_option_id: optionId });
    if (((taken as number | null) ?? 0) > d.capacity) {
      return { error: `Ya hay ${taken} lugares tomados: el cupo no puede ser menor.`, field: 'capacity' };
    }
  }

  const values = { name: d.name, departure: d.departure, price_uyu: d.price, capacity: d.capacity };
  const res = optionId
    ? await db.from('transport_options').update(values).eq('id', optionId).eq('event_id', eventId).select('id').single()
    : await db.from('transport_options').insert({ ...values, event_id: eventId }).select('id').single();

  if (res.error) {
    if (res.error.code === '23505') return { error: 'Ya hay una opción con ese nombre en este evento.', field: 'name' };
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  await logAdminAction(
    admin.id,
    optionId ? 'update_transport_option' : 'create_transport_option',
    'transport_option',
    res.data.id,
  );
  // La lista la refresca el formulario (router.replace), igual que en Barra y Descuentos.
  return { ok: true, name: d.name };
}

export async function toggleTransportOptionAction(eventId: string, optionId: string, active: boolean): Promise<void> {
  const admin = await requireOwner();
  await createAdminClient().from('transport_options').update({ active }).eq('id', optionId).eq('event_id', eventId);
  await logAdminAction(admin.id, active ? 'enable_transport_option' : 'disable_transport_option', 'transport_option', optionId);
  revalidatePath(transportPath(eventId));
}

// Solo se borra una opción que nunca se reservó (la FK de ticket_transport es RESTRICT); si
// alguien la eligió, se desactiva.
export async function deleteTransportOptionAction(eventId: string, optionId: string): Promise<{ error: string } | void> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden cambiar el transporte.' };
  const { data, error } = await createAdminClient()
    .from('transport_options')
    .delete()
    .eq('id', optionId)
    .eq('event_id', eventId)
    .select('name');
  if (error) {
    if (error.code === '23503') return { error: 'Alguien eligió esta opción: no se puede eliminar. Desactivala.' };
    return { error: 'No se pudo eliminar. Probá de nuevo.' };
  }
  if (data[0]) {
    await logAdminAction(admin.id, 'delete_transport_option', 'transport_option', optionId, { deleted: data[0].name });
  }
  revalidatePath(transportPath(eventId));
}
