'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatUYU } from '@/lib/events';
import { validateCI } from '@/lib/validation/document';
import { cn } from '@/lib/utils';
import { startCheckoutAction, type CheckoutState } from './actions';

type Tanda = { id: string; name: string; price: number; fee: number; total: number; purchasable: boolean };

function Submit({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Te llevamos a Mercado Pago...' : `Pagar ${formatUYU(total)}`}
    </Button>
  );
}

// Compra: 1) se elige la tanda tocando su tarjeta (puede venir elegida desde la landing),
// 2) datos de la persona (la entrada es nominativa: en puerta se coteja la cédula),
// 3) desglose en pesos: entrada + cargo por servicio = total que cobra Mercado Pago.
export function BuyForm({ tandas, initialTanda }: { tandas: Tanda[]; initialTanda?: string }) {
  const [state, action] = useFormState<CheckoutState, FormData>(startCheckoutAction, null);
  const firstAvailable = tandas.find((t) => t.purchasable)?.id;
  const [selected, setSelected] = useState(
    tandas.find((t) => t.id === initialTanda && t.purchasable)?.id ?? firstAvailable,
  );
  const tanda = tandas.find((t) => t.id === selected);

  // El error del servidor se oculta apenas la persona edita ese campo.
  const [editedField, setEditedField] = useState<string | null>(null);
  useEffect(() => setEditedField(null), [state]);
  // La cédula se valida en el navegador al salir del campo (mismo dígito verificador que el servidor).
  const [ciError, setCiError] = useState<string | null>(null);
  const fieldError = (name: string) =>
    state?.field === name && editedField !== name ? state.error : null;

  return (
    <form action={action} className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-bone/70">Elegí tu tanda</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {tandas.map((t) => (
            <label
              key={t.id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-card border p-5 transition-colors',
                !t.purchasable && 'cursor-not-allowed opacity-60',
                selected === t.id ? 'border-bone bg-bone/[0.06]' : 'border-bone/15 hover:border-bone/40',
              )}
            >
              <input
                type="radio"
                name="tier"
                value={t.id}
                checked={selected === t.id}
                disabled={!t.purchasable}
                onChange={() => setSelected(t.id)}
                className="sr-only"
              />
              <span className="text-[11px] font-bold uppercase tracking-label text-bone/55">{t.name}</span>
              <span className={cn('mt-2 text-3xl font-bold tracking-tight', !t.purchasable && 'line-through decoration-2')}>
                {formatUYU(t.price)}
              </span>
              <span
                className={cn(
                  'mt-3 text-sm font-bold uppercase tracking-[0.12em]',
                  t.purchasable ? 'text-bone/70' : 'text-alert',
                )}
              >
                {t.purchasable ? 'Disponible' : 'Sold out'}
              </span>
              {selected === t.id && (
                <span aria-hidden className="absolute right-4 top-4 h-3 w-3 rounded-full bg-violet" />
              )}
            </label>
          ))}
        </div>
        {fieldError('tier') && <p className="text-sm text-alert">{fieldError('tier')}</p>}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-sm font-medium text-bone/70">Tus datos</legend>
        <Field label="Nombre y apellido" error={fieldError('name')}>
          <Input name="name" required autoComplete="name" onChange={() => setEditedField('name')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Cédula" hint="La vas a mostrar en puerta" error={ciError ?? fieldError('document')}>
            <Input
              name="document"
              required
              inputMode="numeric"
              autoComplete="off"
              onChange={() => {
                setCiError(null);
                setEditedField('document');
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                setCiError(v && !validateCI(v) ? 'Cédula inválida: revisá los números y el dígito verificador.' : null);
              }}
            />
          </Field>
          <Field label="Instagram" hint="Tu usuario, sin @" error={fieldError('instagram')}>
            <Input
              name="instagram"
              required
              autoComplete="off"
              autoCapitalize="none"
              onChange={() => setEditedField('instagram')}
            />
          </Field>
        </div>
        <Field label="Email" hint="Te mandamos la entrada acá" error={fieldError('email')}>
          <Input name="email" type="email" required autoComplete="email" onChange={() => setEditedField('email')} />
        </Field>
        <Field label="Celular (opcional)">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
      </fieldset>

      {tanda && (
        <dl className="space-y-2 rounded-card border border-bone/10 p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-bone/65">Entrada · {tanda.name}</dt>
            <dd>{formatUYU(tanda.price)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bone/65">Cargo por servicio</dt>
            <dd>{formatUYU(tanda.fee)}</dd>
          </div>
          <div className="flex justify-between border-t border-bone/10 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatUYU(tanda.total)}</dd>
          </div>
        </dl>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-bone/70">
        <input type="checkbox" name="accept" className="mt-0.5 h-4 w-4 shrink-0 accent-bone" />
        Entiendo que la entrada es personal e intransferible: una por persona, y en puerta me piden
        la cédula.
      </label>
      {state && (!state.field || state.field === 'accept') && editedField === null && (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      )}
      <div className="space-y-3">
        <Submit total={tanda?.total ?? 0} />
        <p className="text-center text-xs text-bone/45">
          Pagás en Mercado Pago con tarjeta, débito, saldo o en efectivo. Tenés 20 minutos para
          completar el pago.
        </p>
      </div>
    </form>
  );
}
