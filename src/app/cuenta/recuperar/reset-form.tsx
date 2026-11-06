'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/admin/submit-button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requestPasswordResetAction, type FormState } from '../actions';

export function ResetForm() {
  const [state, action] = useFormState<FormState, FormData>(requestPasswordResetAction, null);

  if (state?.ok) {
    return (
      <div role="status" className="space-y-6 text-center">
        <p className="text-sm leading-relaxed text-bone/80">
          Si hay una cuenta con <strong className="text-bone">{state.ok}</strong>, te llegó un mail con
          el link. Vence en 1 hora. Si no lo ves, revisá spam.
        </p>
        <Link
          href="/cuenta/ingresar"
          className="inline-block p-1 text-sm text-bone/60 underline decoration-bone/30 underline-offset-4 transition-colors hover:text-bone"
        >
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" hint="El de tu cuenta: el mismo con el que compraste" error={state?.error}>
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full">
        Mandame el link
      </SubmitButton>
      <Link
        href="/cuenta/ingresar"
        className="self-center p-1 text-sm text-bone/60 underline decoration-bone/30 underline-offset-4 transition-colors hover:text-bone"
      >
        Volver a ingresar
      </Link>
    </form>
  );
}
