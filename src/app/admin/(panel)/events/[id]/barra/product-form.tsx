'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { saveBarProductAction, type ProductFormState } from './actions';

type Product = { id: string; name: string; description: string | null; price: number };

// Alta de un trago (sin `product`) o edición de uno existente.
// El aviso de "agregado" llega por la URL (?agregado=…), como en Descuentos: al refrescar la
// lista el formulario se vuelve a montar y un estado local se perdería.
export function ProductForm({ eventId, product, notice }: { eventId: string; product?: Product; notice?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProductFormState>(null);
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveBarProductAction(eventId, product?.id ?? null, data);
      setResult(r);
      if (r && 'ok' in r) {
        const q = product ? `guardado=${product.id}` : `agregado=${encodeURIComponent(r.name)}`;
        router.replace(`?${q}`, { scroll: false });
      }
    });
  }

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
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending}>
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
