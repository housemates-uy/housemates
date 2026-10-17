'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updateGatePasswordAction } from './actions';

export function GatePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('idle');
    startTransition(async () => {
      const result = await updateGatePasswordAction(password);
      if ('error' in result) {
        setErrorMsg(result.error);
        setStatus('error');
      } else {
        setPassword('');
        setStatus('ok');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Nueva contraseña del gate"
        hint="Mínimo 6 caracteres"
        error={status === 'error' ? errorMsg : null}
      >
        <Input
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="outline" disabled={pending || password.length < 6}>
          {pending ? 'Guardando...' : 'Guardar contraseña'}
        </Button>
        {status === 'ok' && (
          <p role="status" className="text-sm text-bone/75">
            Contraseña actualizada correctamente.
          </p>
        )}
      </div>
    </form>
  );
}
