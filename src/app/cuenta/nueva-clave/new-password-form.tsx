'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/admin/submit-button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updatePasswordAction, type FormState } from '../actions';

export function NewPasswordForm({ email }: { email: string }) {
  const [state, action] = useFormState<FormState, FormData>(updatePasswordAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Para que el gestor de contraseñas la guarde con el email correcto. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Contraseña nueva" error={state?.error}>
        <Input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
