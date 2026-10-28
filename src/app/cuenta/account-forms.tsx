'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/admin/submit-button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resendConfirmAction, updateProfileAction, type FormState } from './actions';

export function ProfileForm({
  name,
  phone,
  document,
  email,
}: {
  name: string;
  phone: string;
  document: string;
  email: string;
}) {
  const [state, action] = useFormState<FormState, FormData>(updateProfileAction, null);

  return (
    <form action={action} className="space-y-5">
      <Field label="Nombre y apellido" error={state?.error}>
        <Input name="name" defaultValue={name} required autoComplete="name" />
      </Field>
      <Field label="Celular (opcional)">
        <Input name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      </Field>
      <dl className="grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[13px] font-medium text-bone/70">Cédula</dt>
          <dd className="mt-2 text-bone/85">{document}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] font-medium text-bone/70">Email</dt>
          <dd className="mt-2 break-all text-bone/85">{email}</dd>
        </div>
      </dl>
      <p className="text-xs text-bone/45">La cédula y el email no se cambian desde acá: si hay un error, escribinos por Instagram.</p>
      <div className="flex items-center gap-4">
        <SubmitButton variant="outline">Guardar cambios</SubmitButton>
        {state?.ok && (
          <p role="status" className="text-sm text-bone/70">
            {state.ok}
          </p>
        )}
      </div>
    </form>
  );
}

export function ResendConfirm() {
  const [state, action] = useFormState<FormState, FormData>(resendConfirmAction, null);

  return (
    <form action={action} className="mt-4 space-y-2">
      <SubmitButton variant="outline" size="sm">
        Mandame el link de nuevo
      </SubmitButton>
      {(state?.ok || state?.error) && (
        <p role="status" className={state.error ? 'text-xs text-alert' : 'text-xs text-bone/65'}>
          {state.ok ?? state.error}
        </p>
      )}
    </form>
  );
}
