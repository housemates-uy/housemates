'use client';

import { useId, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileUp } from 'lucide-react';
import { ConfirmSubmitButton } from '@/components/admin/submit-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ConfirmCancel() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
      {pending ? 'Anulando...' : 'Sí, anular'}
    </Button>
  );
}

// Anular una entrada cobrada por transferencia: pide el comprobante de la devolución (§5.4).
// Es un <details> para que "Anular" del menú de la fila (reveal) lo abra y ponga el foco en el
// archivo; abierto, se ve como el diálogo de confirmación del menú.
export function RefundReceiptCancel({
  action,
  id,
  name,
}: {
  action: (state: CancelTicketState, formData: FormData) => Promise<CancelTicketState>;
  id: string;
  name: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // El error del servidor es del último envío: al elegir otro archivo o cerrar, deja de verse.
  const [staleError, setStaleError] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const error = fileError ?? (staleError ? null : state?.error ?? null);

  function close() {
    if (details.current) details.current.open = false;
    summary.current?.focus({ preventScroll: true });
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    const problem = !picked
      ? null
      : !RECEIPT_ACCEPT.split(',').includes(picked.type)
        ? 'Tiene que ser una foto JPG, PNG o WebP, o un PDF.'
        : picked.size > RECEIPT_MAX_BYTES
          ? 'Pesa más de 4 MB: subí una captura o un PDF más liviano.'
          : null;
    if (problem) e.target.value = '';
    setStaleError(true);
    setFileError(problem);
    setFile(problem ? null : picked);
  }

  // Esc cierra y Tab no se va del diálogo. Nada de esto llega a la fila: ahí abriría su menú.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input, button:not(:disabled)'));
      const i = focusable.indexOf(document.activeElement as HTMLElement);
      const next = i + (e.shiftKey ? -1 : 1);
      if (next < 0 || next >= focusable.length) {
        e.preventDefault();
        focusable[(next + focusable.length) % focusable.length]?.focus();
      }
    }
  }

  return (
    <details
      ref={details}
      id={id}
      onToggle={(e) => {
        if (e.currentTarget.open) {
          input.current?.focus({ preventScroll: true });
        } else {
          setFile(null);
          setFileError(null);
          setStaleError(true);
          if (input.current) input.current.value = '';
        }
      }}
    >
      <summary
        ref={summary}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}
      >
        Anular
      </summary>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/75 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) close();
        }}
        onContextMenu={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-sm rounded-card border border-bone/15 bg-ink p-5 text-left shadow-[0_16px_48px_rgba(0,0,0,0.65)] [@media(pointer:coarse)]:select-text"
        >
          <h2 id={titleId} className="text-base font-bold leading-snug tracking-tight">
            ¿Anular la entrada de {name}?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-bone/60">
            Se pagó por transferencia: subí el comprobante de que le devolviste la plata. La entrada deja de
            servir en la puerta y le avisamos por mail.
          </p>
          <form action={formAction} onSubmit={() => setStaleError(false)} className="mt-4 space-y-2">
            <span className="text-[13px] font-medium text-bone/70">Comprobante de devolución</span>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-control border border-dashed px-4 py-4 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bone/60',
                file ? 'border-bone/40 text-bone' : 'border-bone/20 text-bone/60 hover:border-bone/40',
              )}
            >
              <FileUp size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">{file ? `${file.name} · ${fileSize(file.size)}` : 'Elegí el archivo'}</span>
              <input
                ref={input}
                type="file"
                name="refund_receipt"
                accept={RECEIPT_ACCEPT}
                required
                onChange={pick}
                aria-describedby={`${titleId}-ayuda`}
                className="sr-only"
              />
            </label>
            {error ? (
              <p role="alert" className="text-xs text-alert">
                {error}
              </p>
            ) : (
              <p id={`${titleId}-ayuda`} className="text-xs text-bone/55">
                Foto JPG, PNG o WebP, o PDF. Hasta 4 MB.
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <ConfirmCancel />
            </div>
          </form>
        </div>
      </div>
    </details>
  );
}
