'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginAction(
        formData.get('email') as string,
        formData.get('password') as string,
      );
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <main id="contenido" className="flex min-h-[100dvh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4">
          <Logo className="h-20" />
          <h1 className="text-[11px] font-bold uppercase tracking-label text-bone/50">Admin</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Contraseña" error={error}>
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </main>
  );
}
