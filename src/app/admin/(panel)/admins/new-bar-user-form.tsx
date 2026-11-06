'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createBarUserAction, type BarUserFormState } from './actions';

export function NewBarUserForm({ scanUrl }: { scanUrl: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BarUserFormState>(null);
  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createBarUserAction(data);
      setResult(r);
      if (r && 'ok' in r) {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 rounded-card border border-bone/10 p-4 sm:p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" hint="Ej: Barra" error={fieldError('name')}>
          <Input name="name" required maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Email" hint="Uno que no use nadie más" error={fieldError('email')}>
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
      </div>
      <Field label="Contraseña" hint="Mínimo 8 caracteres. Se la pasás a los barmans" error={fieldError('password')}>
        <Input name="password" type="text" required minLength={8} maxLength={72} autoComplete="new-password" spellCheck={false} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creando...' : 'Crear usuario de barra'}
        </Button>
        {error && !error.field && (
          <p role="alert" className="text-sm text-alert">
            {error.error}
          </p>
        )}
        {result && 'ok' in result && (
          <p role="status" className="text-sm text-bone/70">
            Listo: {result.email} ya puede entrar en {scanUrl} con esa contraseña.
          </p>
        )}
      </div>
    </form>
  );
}
