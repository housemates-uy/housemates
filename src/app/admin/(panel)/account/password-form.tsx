'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updatePasswordAction } from './actions';

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePasswordAction(password);
      if ('error' in result) {
        setError(result.error);
      } else {
        setPassword('');
        setConfirm('');
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </Field>
      <Field label="Repetí la contraseña" error={error}>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending || password.length < 8}>
          {pending ? 'Guardando...' : 'Guardar contraseña'}
        </Button>
        {saved && (
          <p role="status" className="text-sm text-bone/75">
            Listo. Desde ahora entrás con esta contraseña.
          </p>
        )}
      </div>
    </form>
  );
}
