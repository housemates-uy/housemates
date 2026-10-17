'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

// Botón de submit para <form action={serverAction}>: se deshabilita mientras corre.
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {children}
    </Button>
  );
}

// Para acciones difíciles de deshacer: pide confirmación en el lugar, sin modal.
export function ConfirmSubmitButton({
  children,
  confirmLabel,
  ...props
}: ButtonProps & { confirmLabel: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" onClick={() => setConfirming(true)} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <SubmitButton {...props} variant="danger">
        {confirmLabel}
      </SubmitButton>
      <Button type="button" variant="ghost" size={props.size} onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </span>
  );
}
