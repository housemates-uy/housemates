'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LogoIntro } from '@/components/ui/logo-intro';
import { cn } from '@/lib/utils';

export function AccessForm({ next, notice }: { next: string; notice?: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [attempts, setAttempts] = useState(0);
  const buying = next.startsWith('/entradas') || next.startsWith('/checkout');

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
          ? 'No es una contraseña ni un código válido. Si cambió, pedinos el nuevo por Instagram.'
          : res.status === 409
            ? 'Ese código ya se usó para todas sus entradas. Escribinos por Instagram.'
            : res.status === 429
              ? 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.'
              : 'No pudimos verificarlo. Probá de nuevo.',
      );
    } catch {
      setError('Sin conexión. Probá de nuevo.');
    }

    setAttempts((n) => n + 1);
    setPassword('');
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center text-center">
      <LogoIntro className="h-32 w-32" />

      {/* Desde la portada o las preguntas frecuentes llega gente que quiere ver el lugar o las reglas. */}
      <h1 className="mt-8 text-2xl font-bold tracking-tight">{buying ? 'Entradas' : 'La casa'}</h1>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-bone/60">
        {buying
          ? 'Para comprar necesitás la contraseña o tu código de acceso. Te lo pasamos por Instagram.'
          : 'Para ver el lugar, las reglas y comprar entradas necesitás la contraseña o tu código de acceso. Te lo pasamos por Instagram.'}
      </p>

      <form
        onSubmit={handleSubmit}
        key={attempts}
        className={cn('mt-8 flex w-full flex-col gap-4 text-left', error && 'animate-shake')}
      >
        <Field label="Contraseña o código" error={error}>
          <Input
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={attempts > 0}
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
