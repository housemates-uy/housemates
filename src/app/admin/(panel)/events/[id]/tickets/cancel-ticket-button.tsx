'use client';

import { useFormState } from 'react-dom';
import { ConfirmSubmitButton } from '@/components/admin/submit-button';
import type { CancelTicketState } from './actions';

// Anular / Reembolsar. Si no se pudo (p. ej. la entrada se usó mientras tanto), el motivo
// aparece al lado del botón; si se anuló, la página muestra el resultado (viene en la URL).
export function CancelTicketButton({
  action,
  mode,
}: {
  action: (state: CancelTicketState) => Promise<CancelTicketState>;
  mode: 'cancel' | 'refund';
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <>
      {/* La key vuelve el botón a "Anular" después de un error (si no, queda en "Sí, anular"). */}
      <form key={state?.error ?? ''} action={formAction}>
        <ConfirmSubmitButton
          variant="ghost"
          size="sm"
          confirmLabel={mode === 'refund' ? 'Sí, reembolsar' : 'Sí, anular'}
        >
          {mode === 'refund' ? 'Reembolsar' : 'Anular'}
        </ConfirmSubmitButton>
      </form>
      {state && (
        <p role="alert" className="basis-full text-right text-xs text-alert">
          {state.error}
        </p>
      )}
    </>
  );
}
