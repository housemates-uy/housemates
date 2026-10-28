'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { loginAction, requestPasswordResetAction } from './actions';

export default function LoginPage() {
  const errorParam = useSearchParams().get('error');
  const [error, setError] = useState<string | null>(
    errorParam === 'link'
      ? 'El link venció o ya se usó. Pedí uno nuevo con "Olvidé mi contraseña".'
      : errorParam === 'noadmin'
        ? 'Tu usuario existe pero no está habilitado como admin. Pedile a un owner que lo habilite.'
        : null,
  );
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  function handleReset() {
    if (!email) {
      setError('Escribí tu email y volvé a tocar "Olvidé mi contraseña".');
      return;
    }
    setError(null);
    startTransition(async () => {
      await requestPasswordResetAction(email);
      setResetSent(true);
    });
  }

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
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Contraseña" error={error}>
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          {resetSent ? (
            <p role="status" className="text-sm text-bone/70">
              Si el email está registrado, te llegó un link para elegir contraseña.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={pending}
              className="text-sm text-bone/55 underline-offset-4 hover:text-bone hover:underline"
            >
              Olvidé mi contraseña
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
