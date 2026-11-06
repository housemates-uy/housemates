'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, inputClass } from '@/components/ui/input';
import { createDiscountCodeAction, type CodeFormState } from './actions';

// El mensaje de "creado" llega por la URL (?creado=CODIGO): al refrescar la lista el
// formulario se vuelve a montar y un estado local se perdería.
export function NewCodeForm({ eventId, created }: { eventId: string; created?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CodeFormState>(null);
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent');
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createDiscountCodeAction(eventId, null, data);
      setResult(r);
      if (r && 'ok' in r) {
        formRef.current?.reset();
        setKind('percent');
        router.replace(`?creado=${encodeURIComponent(r.code)}`, { scroll: false });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 rounded-card border border-bone/10 p-5">
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Field label="Código" hint="Lo que escribe la persona. Ej: AMIGOS10" error={fieldError('code')}>
          <Input name="code" required autoComplete="off" autoCapitalize="characters" className="uppercase tracking-wide" />
        </Field>
        <Field label="Tipo">
          <select
            name="kind"
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}
          >
            <option value="percent">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </Field>
        <Field label={kind === 'percent' ? 'Descuento (%)' : 'Descuento ($)'} error={fieldError('value')}>
          <Input name="value" type="number" min={1} max={kind === 'percent' ? 99 : undefined} step={1} required />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Usos máximos (opcional)" hint="Vacío = sin tope" error={fieldError('max_uses')}>
          <Input name="max_uses" type="number" min={1} step={1} />
        </Field>
        <Field label="Vence (opcional)" hint="Hora de Montevideo" error={fieldError('valid_until')}>
          <Input name="valid_until" type="datetime-local" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Creando...' : 'Crear código'}
        </Button>
        {created && !error && (
          <p role="status" className="text-sm text-bone/75">
            Código {created} creado.
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
