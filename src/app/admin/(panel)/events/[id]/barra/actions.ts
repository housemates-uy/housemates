'use server';

// Barra de un evento: carta (cargar, editar con foto, activar/desactivar, ordenar, eliminar) y
// pausar la venta. Todo esto es solo para owners. Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Barra".
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { BAR_BUCKET } from '@/lib/bar';
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

// La foto llega ya achicada por el navegador (product-form.tsx). El tipo se saca de los
// primeros bytes, no de lo que dice el navegador.
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

function imageType(bytes: Uint8Array): { ext: string; mime: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(bytes.slice(from, to)));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

// Un archivo puede ser de varios tragos (al duplicar un evento la carta copia la ruta): se
// borra del bucket solo cuando ya no lo usa ninguno.
async function removeImageIfUnused(db: ReturnType<typeof createAdminClient>, path: string | null | undefined) {
  if (!path) return;
  const { count, error } = await db
    .from('bar_products')
    .select('id', { count: 'exact', head: true })
    .eq('image_path', path);
  if (error || count) return;
  const { error: removeError } = await db.storage.from(BAR_BUCKET).remove([path]);
  if (removeError) console.error('[barra] no se pudo borrar la foto vieja', path, removeError.message);
}

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

  const { data: current } = productId
    ? await db.from('bar_products').select('image_path').eq('id', productId).eq('event_id', eventId).maybeSingle()
    : { data: null };
  if (productId && !current) return { error: 'Ese trago ya no está en la carta. Recargá la página.' };

  // Foto nueva: se sube antes de guardar; si después no se puede guardar, se borra.
  let newImage: string | null = null;
  const file = formData.get('image');
  if (file instanceof Blob && file.size > 0) {
    if (file.size > IMAGE_MAX_BYTES) return { error: 'La foto pesa más de 4 MB: probá con otra.', field: 'image' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) return { error: 'Tiene que ser una foto JPG, PNG o WebP.', field: 'image' };
    newImage = `${eventId}/${randomBytes(4).toString('hex')}.${type.ext}`;
    const { error: uploadError } = await db.storage
      .from(BAR_BUCKET)
      .upload(newImage, bytes, { contentType: type.mime, cacheControl: '31536000', upsert: false });
    if (uploadError) return { error: 'No se pudo subir la foto. Probá de nuevo.', field: 'image' };
  }
  const removeImage = !newImage && formData.get('remove_image') === '1';
  const image = newImage ? { image_path: newImage } : removeImage ? { image_path: null } : {};

  let error: { code?: string } | null;
  let id = productId;
  if (productId) {
    ({ error } = await db
      .from('bar_products')
      .update({ name: d.name, description: d.description || null, price_uyu: d.price, ...image })
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
        ...image,
      })
      .select('id')
      .single();
    error = res.error;
    id = res.data?.id ?? null;
  }

  if (error) {
    if (newImage) await db.storage.from(BAR_BUCKET).remove([newImage]);
    if (error.code === '23505') return { error: 'Ya hay un trago con ese nombre en este evento.', field: 'name' };
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  if (newImage || removeImage) await removeImageIfUnused(db, current?.image_path);
  await logAdminAction(
    admin.id,
    productId ? 'update_bar_product' : 'create_bar_product',
    'bar_product',
    id ?? undefined,
    newImage ? { photo: 'Nueva' } : removeImage && current?.image_path ? { photo: 'Sacada' } : undefined,
  );
  // La lista la refresca el formulario (router.refresh), igual que en Descuentos.
  return { ok: true, name: d.name };
}

export async function toggleBarProductAction(eventId: string, productId: string, active: boolean): Promise<void> {
  const admin = await requireOwner();
  await createAdminClient().from('bar_products').update({ active }).eq('id', productId).eq('event_id', eventId);
  await logAdminAction(admin.id, active ? 'enable_bar_product' : 'disable_bar_product', 'bar_product', productId);
  revalidatePath(barPath(eventId));
}

// Solo un trago que no está en ningún pedido (de cualquier estado): si no, se desactiva
// (admin_delete_bar_product, migración 0025).
export async function deleteBarProductAction(eventId: string, productId: string): Promise<{ error: string } | void> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden cambiar la carta.' };
  const db = createAdminClient();
  const { data: product } = await db.from('bar_products').select('name, image_path').eq('id', productId).maybeSingle();
  const { data: result, error } = await db.rpc('admin_delete_bar_product', {
    p_product_id: productId,
    p_event_id: eventId,
  });
  if (error) return { error: 'No se pudo eliminar el trago. Probá de nuevo.' };
  if (result === 'in_use') return { error: 'El trago está en pedidos: no se puede eliminar. Desactivalo.' };
  if (result === 'deleted') {
    await removeImageIfUnused(db, product?.image_path);
    await logAdminAction(admin.id, 'delete_bar_product', 'bar_product', productId, { deleted: product?.name ?? null });
  }
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
