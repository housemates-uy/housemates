'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createAccessCodeAction, type AccessFormState } from './actions';

// El código creado llega a la página por la URL (?creado=CODIGO): al refrescar, la página
// se vuelve a montar y un estado local se perdería.
export function NewAccessForm({ eventId }: { eventId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AccessFormState>(null);
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createAccessCodeAction(eventId, data);
      setResult(r);
      if (r && 'ok' in r) {
        formRef.current?.reset();
        router.replace(`?creado=${encodeURIComponent(r.code)}`);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 rounded-card border border-bone/10 p-4 sm:p-5">
      <Field
        label="¿Para quién?"
        hint="Ej: Sofi @sofi.mates y amigas, o Historia 20/11"
        error={fieldError('label')}
      >
        <Input name="label" required maxLength={120} autoComplete="off" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="¿Cuántas entradas?" hint="Cada entrada que se compra gasta una" error={fieldError('max_uses')}>
          <Input name="max_uses" type="number" inputMode="numeric" min={1} max={1000} step={1} defaultValue={1} required />
        </Field>
        <Field label="Vence (opcional)" hint="Hora de Montevideo. Vacío = no vence" error={fieldError('valid_until')}>
          <Input name="valid_until" type="datetime-local" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creando...' : 'Crear código'}
        </Button>
        {error && !error.field && (
          <p role="alert" className="text-sm text-alert">
            {error.error}
          </p>
        )}
      </div>
    </form>
  );
}
