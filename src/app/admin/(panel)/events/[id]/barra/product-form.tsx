'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GlassWater } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { saveBarProductAction, type ProductFormState } from './actions';

type Product = { id: string; name: string; description: string | null; price: number; image: string | null };

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const IMAGE_MAX_SIDE = 1400;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// La foto se achica en el navegador antes de mandarla: una del celular pesa varios MB y en
// /barra se ve chica. WebP si el navegador lo sabe hacer; si no, JPG.
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  const webp = await encode('image/webp');
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg');
  if (!blob) throw new Error('encode');
  return blob;
}

// Alta de un trago (sin `product`) o edición de uno existente, con su foto.
// El aviso de "agregado" llega por la URL (?agregado=…), como en Descuentos: al refrescar la
// lista el formulario se vuelve a montar y un estado local se perdería.
export function ProductForm({ eventId, product, notice }: { eventId: string; product?: Product; notice?: string }) {
  const router = useRouter();
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProductFormState>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [reading, setReading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  const shown = image?.url ?? (removed ? null : product?.image ?? null);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError(null);
    setResult(null);
    if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
      setImageError('Tiene que ser una foto JPG, PNG o WebP.');
      return;
    }
    setReading(true);
    try {
      const blob = await shrinkImage(file);
      if (blob.size > IMAGE_MAX_BYTES) throw new Error('size');
      setImage({ blob, url: URL.createObjectURL(blob) });
      setRemoved(false);
    } catch {
      setImageError('No se pudo leer la foto. Probá con otra.');
    } finally {
      setReading(false);
    }
  }

  function removeImage() {
    setImage(null);
    setRemoved(!!product?.image);
    setImageError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (image) data.set('image', image.blob, 'foto');
    if (removed) data.set('remove_image', '1');
    startTransition(async () => {
      const r = await saveBarProductAction(eventId, product?.id ?? null, data);
      setResult(r);
      if (r && 'ok' in r) {
        setImage(null);
        setRemoved(false);
        const q = product ? `guardado=${product.id}` : `agregado=${encodeURIComponent(r.name)}`;
        router.replace(`?${q}`, { scroll: false });
      }
    });
  }

  const photoError = imageError ?? fieldError('image');

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[1.6fr_1fr]">
        <Field label="Nombre" hint="Como lo va a ver la gente. Ej: Fernet con Coca" error={fieldError('name')}>
          <Input name="name" required maxLength={80} defaultValue={product?.name} autoComplete="off" />
        </Field>
        <Field label="Precio ($)" hint="Precio final: sin cargo por servicio" error={fieldError('price')}>
          <Input name="price" type="number" min={1} step={1} required defaultValue={product?.price} inputMode="numeric" />
        </Field>
      </div>
      <Field label="Descripción (opcional)" error={fieldError('description')}>
        <Input name="description" maxLength={200} defaultValue={product?.description ?? ''} autoComplete="off" />
      </Field>

      <div className="flex flex-col gap-2">
        <span id={`${fileId}-label`} className="text-[13px] font-medium text-bone/70">
          Foto (opcional)
        </span>
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-bone/10 bg-bone/[0.04]">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local o del bucket público
              <img src={shown} alt="" className="h-full w-full object-cover" />
            ) : (
              <GlassWater size={26} strokeWidth={1.5} aria-hidden className="text-bone/30" />
            )}
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || reading}
                onClick={() => fileInput.current?.click()}
                aria-describedby={`${fileId}-hint`}
              >
                {reading ? 'Leyendo la foto...' : shown ? 'Cambiar foto' : 'Elegir foto'}
              </Button>
              {shown && (
                <Button type="button" variant="ghost" size="sm" disabled={pending || reading} onClick={removeImage}>
                  Sacar la foto
                </Button>
              )}
            </div>
            <p id={`${fileId}-hint`} className="text-xs text-bone/55">
              {image
                ? 'Se guarda al tocar el botón de abajo.'
                : removed
                  ? 'La foto se saca al guardar.'
                  : 'En /barra se ve cuadrada: se recorta al centro.'}
            </p>
            {photoError && (
              <p role="alert" className="text-xs text-alert">
                {photoError}
              </p>
            )}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={pickImage}
          aria-labelledby={`${fileId}-label`}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending || reading}>
          {pending ? 'Guardando...' : product ? 'Guardar cambios' : 'Agregar trago'}
        </Button>
        {notice && !error && (
          <p role="status" className="text-sm text-bone/75">
            {notice}
          </p>
        )}
        {error && !error.field && (
          <p role="alert" className="text-sm text-alert">
            {error.error}
          </p>
        )}
      </div>
    </form>
  );
}
