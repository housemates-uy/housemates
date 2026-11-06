'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/admin/submit-button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signInAction, type FormState } from '../actions';

export function SignInForm({ next, linkExpired }: { next: string; linkExpired: boolean }) {
  const [state, action] = useFormState<FormState, FormData>(signInAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {linkExpired && !state && (
        <p role="alert" className="rounded-control border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-bone/85">
          El link venció o ya se usó. Ingresá con tu contraseña o pedí un link nuevo.
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Contraseña" error={state?.error}>
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full">
        Ingresar
      </SubmitButton>
      <Link
        href="/cuenta/recuperar"
        className="self-center p-1 text-sm text-bone/60 underline decoration-bone/30 underline-offset-4 transition-colors hover:text-bone"
      >
        ¿Te olvidaste la contraseña?
      </Link>
    </form>
  );
}
