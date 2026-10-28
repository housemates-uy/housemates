'use server';

// Barra de un evento: carta (cargar, editar, activar/desactivar, ordenar) y pausar la venta.
// Todo esto es solo para owners. Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Barra".
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export type ProductFormState = { error: string; field?: string } | { ok: true; name: string } | null;

const productSchema = z.object({
  name: z.string().trim().min(1, 'Poné el nombre del trago').max(80, 'Hasta 80 letras'),
  description: z.string().trim().max(200, 'Hasta 200 letras').optional().or(z.literal('')),
  price: z.coerce
    .number({ invalid_type_error: 'Poné el precio' })
    .int('En pesos, sin centavos')
    .positive('Tiene que ser mayor a 0')
    .max(100000, 'Revisá el precio'),
});

const barPath = (eventId: string) => `/admin/events/${eventId}/barra`;

// Alta (productId = null) o edición. Cambiar el precio no toca los pedidos ya hechos: cada
// pedido guarda el nombre y el precio del momento.
export async function saveBarProductAction(
  eventId: string,
  productId: string | null,
  formData: FormData,
): Promise<ProductFormState> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden cambiar la carta.' };

  const parsed = productSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    price: formData.get('price') || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const d = parsed.data;
  const db = createAdminClient();

  let error: { code?: string } | null;
  let id = productId;
  if (productId) {
    ({ error } = await db
      .from('bar_products')
      .update({ name: d.name, description: d.description || null, price_uyu: d.price })
      .eq('id', productId)
      .eq('event_id', eventId));
  } else {
    const { data: last } = await db
      .from('bar_products')
      .select('sort_order')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const res = await db
      .from('bar_products')
      .insert({
        event_id: eventId,
        name: d.name,
        description: d.description || null,
        price_uyu: d.price,
        sort_order: (last?.sort_order ?? 0) + 1,
      })
      .select('id')
      .single();
    error = res.error;
    id = res.data?.id ?? null;
  }

  if (error) {
    if (error.code === '23505') return { error: 'Ya hay un trago con ese nombre en este evento.', field: 'name' };
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  await logAdminAction(admin.id, productId ? 'update_bar_product' : 'create_bar_product', 'bar_product', id ?? undefined);
  // La lista la refresca el formulario (router.refresh), igual que en Descuentos.
  return { ok: true, name: d.name };
}

export async function toggleBarProductAction(eventId: string, productId: string, active: boolean): Promise<void> {
  const admin = await requireOwner();
  await createAdminClient().from('bar_products').update({ active }).eq('id', productId).eq('event_id', eventId);
  await logAdminAction(admin.id, active ? 'enable_bar_product' : 'disable_bar_product', 'bar_product', productId);
  revalidatePath(barPath(eventId));
}

// Sube o baja un trago en la carta. Se renumera todo el evento (0, 1, 2…) para que dos
// tragos con el mismo orden no queden trabados.
export async function moveBarProductAction(eventId: string, productId: string, direction: -1 | 1): Promise<void> {
  const admin = await requireOwner();
  const db = createAdminClient();
  const { data } = await db
    .from('bar_products')
    .select('id, sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  const list = data ?? [];
  const from = list.findIndex((p) => p.id === productId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return;
  [list[from], list[to]] = [list[to], list[from]];

  await Promise.all(
    list.map((p, i) => (p.sort_order === i ? null : db.from('bar_products').update({ sort_order: i }).eq('id', p.id))),
  );
  await logAdminAction(admin.id, 'reorder_bar_product', 'bar_product', productId);
  revalidatePath(barPath(eventId));
}

// Pausar: nadie puede comprar desde /barra. Los QRs ya pagos se siguen entregando.
export async function setBarPausedAction(eventId: string, paused: boolean): Promise<void> {
  const admin = await requireOwner();
  await createAdminClient().from('events').update({ bar_paused: paused }).eq('id', eventId);
  await logAdminAction(admin.id, paused ? 'pause_bar' : 'resume_bar', 'event', eventId);
  revalidatePath(barPath(eventId));
}
