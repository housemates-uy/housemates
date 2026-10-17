'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, inputClass } from '@/components/ui/input';
import { formatUYU } from '@/lib/events';
import { startCheckoutAction, type CheckoutState } from './actions';

type Tanda = { id: string; name: string; price: number; purchasable: boolean };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Te llevamos a Mercado Pago...' : 'Ir a pagar'}
    </Button>
  );
}

// Formulario de compra. Todos los datos se piden porque la entrada es nominativa:
// en puerta se coteja la cédula, y el Instagram nos deja ver quién compró.
export function BuyForm({ tandas }: { tandas: Tanda[] }) {
  const [state, action] = useFormState<CheckoutState, FormData>(startCheckoutAction, null);
  const fieldError = (name: string) => (state?.field === name ? state.error : null);
  const firstAvailable = tandas.find((t) => t.purchasable)?.id;

  return (
    <form action={action} className="space-y-5">
      <Field label="Tanda" error={fieldError('tier')}>
        <select name="tier" className={inputClass} defaultValue={firstAvailable}>
          {tandas.map((t) => (
            <option key={t.id} value={t.id} disabled={!t.purchasable}>
              {t.name} · {formatUYU(t.price)}
              {!t.purchasable && ' · sold out'}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nombre y apellido" error={fieldError('name')}>
        <Input name="name" required autoComplete="name" />
      </Field>
      <Field label="Cédula" hint="La vas a mostrar en puerta" error={fieldError('document')}>
        <Input name="document" required inputMode="numeric" autoComplete="off" />
      </Field>
      <Field label="Email" error={fieldError('email')}>
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Instagram" hint="Tu usuario, sin @" error={fieldError('instagram')}>
        <Input name="instagram" required autoComplete="off" autoCapitalize="none" />
      </Field>
      <Field label="Celular (opcional)">
        <Input name="phone" type="tel" autoComplete="tel" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-bone/70">
        <input type="checkbox" name="accept" className="mt-0.5 h-4 w-4 shrink-0 accent-bone" />
        Entiendo que la entrada es personal e intransferible: una por persona, y en puerta me piden
        la cédula.
      </label>
      {state && (!state.field || state.field === 'accept') && (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      )}
      <Submit />
      <p className="text-center text-xs text-bone/45">
        Pagás en Mercado Pago con tarjeta, débito, saldo o en efectivo. Tenés 20 minutos para
        completar el pago.
      </p>
    </form>
  );
}
