'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { SubmitButton } from '@/components/admin/submit-button';
import { buttonVariants } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { DuplicateFormState } from './actions';

// "2026-12-11T23:00" + minutos, sin pasar por la zona del navegador.
function addMinutes(local: string, minutes: number) {
  const ms = Date.parse(`${local}:00Z`);
  return Number.isNaN(ms) ? '' : new Date(ms + minutes * 60_000).toISOString().slice(0, 16);
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
}

// Las fechas arrancan vacías: las del original son de otra fiesta. Al elegir el inicio, el fin
// se completa con la misma duración que el original, mientras no lo cambies a mano.
export function DuplicateForm({
  action,
  title,
  durationMinutes,
  cancelHref,
}: {
  action: (prev: DuplicateFormState, formData: FormData) => Promise<DuplicateFormState>;
  title: string;
  durationMinutes: number;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const [end, setEnd] = useState('');
  const [endTouched, setEndTouched] = useState(false);
  const fieldError = (name: string) => (state?.field === name ? state.error : undefined);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Título" error={fieldError('title')}>
        <Input name="title" required defaultValue={title} autoComplete="off" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Inicio" hint="Hora de Montevideo" error={fieldError('date_start')}>
          <Input
            name="date_start"
            type="datetime-local"
            required
            onChange={(e) => {
              if (!endTouched) setEnd(addMinutes(e.target.value, durationMinutes));
            }}
          />
        </Field>
        <Field
          label="Fin"
          hint={
            durationMinutes > 0
              ? `Se completa con la duración del original (${formatDuration(durationMinutes)}). Podés cambiarlo.`
              : undefined
          }
          error={fieldError('date_end')}
        >
          <Input
            name="date_end"
            type="datetime-local"
            required
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setEndTouched(true);
            }}
          />
        </Field>
      </div>

      {state && !state.field && (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Copiar evento</SubmitButton>
        <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
