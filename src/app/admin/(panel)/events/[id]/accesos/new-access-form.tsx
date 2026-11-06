'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { AccessCodeKind } from '@/lib/access-codes';
import { cn } from '@/lib/utils';
import { createAccessCodeAction, type AccessFormState } from './actions';

const KINDS: { value: AccessCodeKind; title: string; body: string }[] = [
  {
    value: 'personal',
    title: 'Personal',
    body: 'Para una persona y sus amigos: elegís cuántas entradas.',
  },
  {
    value: 'public',
    title: 'Público',
    body: 'Para una historia de Instagram: elegís cuántas entradas saca cada persona.',
  },
];

// El código creado llega a la página por la URL (?creado=CODIGO): al refrescar, la página
// se vuelve a montar y un estado local se perdería.
export function NewAccessForm({ eventId }: { eventId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AccessFormState>(null);
  const [kind, setKind] = useState<AccessCodeKind>('personal');
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);
  const isPublic = kind === 'public';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createAccessCodeAction(eventId, data);
      setResult(r);
      if (r && 'ok' in r) {
        formRef.current?.reset();
        setKind('personal');
        router.replace(`?creado=${encodeURIComponent(r.code)}`);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-5 rounded-card border border-bone/10 p-4 sm:p-5"
    >
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-[13px] font-medium text-bone/70">Tipo</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={cn(
                'flex cursor-pointer flex-col rounded-card border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bone/60',
                kind === k.value
                  ? 'border-bone bg-bone/[0.06]'
                  : 'border-bone/15 hover:border-bone/40',
              )}
            >
              <input
                type="radio"
                name="kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="sr-only"
              />
              <span className="text-sm font-bold">{k.title}</span>
              <span className="mt-1 text-xs leading-snug text-bone/60">{k.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label="¿Para quién?"
        hint={isPublic ? 'Ej: Historia 20/11' : 'Ej: Sofi @sofi.mates y amigas'}
        error={fieldError('label')}
      >
        <Input name="label" required maxLength={120} autoComplete="off" />
      </Field>
      {isPublic && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Entradas por persona"
            hint="Por dispositivo y por compra. Con 1, si vienen amigos cada uno saca la suya"
            error={fieldError('per_buyer')}
          >
            <Input
              name="per_buyer"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              step={1}
              defaultValue={1}
              required
            />
          </Field>
          <Field
            label="Código propio (opcional)"
            hint="Ej: HOUSEMATES. De 6 a 16 letras o números. Vacío = se sortea uno"
            error={fieldError('custom_code')}
          >
            <Input
              name="custom_code"
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* key: al cambiar de tipo, el campo arranca de nuevo (1 en el personal, vacío en el público). */}
        <Field
          key={kind}
          label={isPublic ? 'Tope de entradas (opcional)' : '¿Cuántas entradas?'}
          hint={
            isPublic
              ? 'Vacío = sin tope. Cada entrada gasta 1'
              : 'Cada entrada que se compra gasta una'
          }
          error={fieldError('max_uses')}
        >
          <Input
            name="max_uses"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            defaultValue={isPublic ? undefined : 1}
            required={!isPublic}
          />
        </Field>
        <Field
          label="Vence (opcional)"
          hint="Hora de Montevideo. Vacío = no vence"
          error={fieldError('valid_until')}
        >
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
