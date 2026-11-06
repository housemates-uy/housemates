'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { saveTransportOptionAction, type OptionFormState } from './actions';

type Option = { id: string; name: string; departure: string; price: number; capacity: number | null };

// Alta de una opción de bus (sin `option`) o edición de una existente.
// El aviso de "agregada" llega por la URL (?agregada=…), como en Barra: al refrescar la
// lista el formulario se vuelve a montar y un estado local se perdería.
export function OptionForm({ eventId, option, notice }: { eventId: string; option?: Option; notice?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OptionFormState>(null);
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const r = await saveTransportOptionAction(eventId, option?.id ?? null, data);
      setResult(r);
      if (r && 'ok' in r) {
        if (!option) form.reset();
        const q = option ? `guardada=${option.id}` : `agregada=${encodeURIComponent(r.name)}`;
        router.replace(`?${q}`, { scroll: false });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[1.6fr_1fr_1fr]">
        <Field label="Nombre" hint="Como lo ve la gente. Ej: Ida y vuelta" error={fieldError('name')}>
          <Input name="name" required maxLength={60} defaultValue={option?.name} autoComplete="off" />
        </Field>
        <Field label="Precio ($)" hint="Por persona" error={fieldError('price')}>
          <Input name="price" type="number" min={1} step={1} required defaultValue={option?.price} inputMode="numeric" />
        </Field>
        <Field label="Cupo (opcional)" hint="Vacío = sin tope" error={fieldError('capacity')}>
          <Input name="capacity" type="number" min={1} step={1} defaultValue={option?.capacity ?? ''} inputMode="numeric" />
        </Field>
      </div>
      <Field
        label="Punto y horario de salida"
        hint="Ej: Sale 22:00 de Tres Cruces (puerta de Bv. Artigas). Vuelve 06:30."
        error={fieldError('departure')}
      >
        <Textarea name="departure" required maxLength={300} rows={4} defaultValue={option?.departure} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Guardando...' : option ? 'Guardar cambios' : 'Agregar opción'}
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
