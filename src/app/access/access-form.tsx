'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LogoIntro } from '@/components/ui/logo-intro';
import { cn } from '@/lib/utils';

export function AccessForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || password.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }

      setError(
        res.status === 401
          ? 'Contraseña incorrecta. Si cambió, pedinos la nueva por Instagram.'
          : 'No pudimos verificar la contraseña. Probá de nuevo.',
      );
    } catch {
      setError('Sin conexión. Probá de nuevo.');
    }

    setPassword('');
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center text-center">
      <LogoIntro className="h-32 w-32" />

      <h1 className="mt-8 text-2xl font-bold tracking-tight">Entradas</h1>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-bone/60">
        La compra es con contraseña. Te la pasamos por Instagram.
      </p>

      <form
        onSubmit={handleSubmit}
        key={error ? `error-${password.length === 0}` : 'form'}
        className={cn('mt-8 flex w-full flex-col gap-4 text-left', error && 'animate-shake')}
      >
        <Field label="Contraseña" error={error}>
          <Input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </Field>
        <Button type="submit" size="lg" disabled={loading || password.length === 0}>
          {loading ? 'Verificando' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
