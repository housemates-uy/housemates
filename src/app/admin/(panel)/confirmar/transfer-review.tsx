'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ImageIcon, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { acceptTransferAction, declineTransferAction } from './actions';

type Props = {
  ticketId: string;
  buyerName: string;
  count: number; // entradas de la compra: se aceptan o declinan todas juntas
  totalLabel: string;
  receipt: 'image' | 'pdf' | null;
  eventFilter: string | null;
};

export function TransferReview({
  ticketId,
  buyerName,
  count,
  totalLabel,
  receipt,
  eventFilter,
}: Props) {
  const [, startTransition] = useTransition();
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Un ref y no solo el estado: el segundo toque de un doble click llega antes de que React
  // vuelva a pintar el botón deshabilitado.
  const sent = useRef(false);
  const receiptUrl = `/admin/confirmar/comprobante/${ticketId}`;
  const closeViewer = useCallback(() => setViewing(false), []);
  const busy = decision !== null;

  function decide(kind: 'accept' | 'decline') {
    if (sent.current) return;
    sent.current = true;
    setDecision(kind);
    setError(null);
    startTransition(async () => {
      try {
        await (kind === 'accept' ? acceptTransferAction : declineTransferAction)(
          ticketId,
          eventFilter,
        );
      } catch {
        sent.current = false;
        setDecision(null);
        setError('No se pudo completar. Revisá la conexión y probá de nuevo.');
      }
    });
  }

  return (
    <>
      <div className="space-y-3">
        {receipt === 'image' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setViewing(true)}
          >
            <ImageIcon size={17} strokeWidth={1.5} aria-hidden />
            Ver comprobante
          </Button>
        )}
        {receipt === 'pdf' && (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}
          >
            Ver comprobante (PDF)
            <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
          </a>
        )}
        {!receipt && (
          <p className="text-sm text-alert">
            Sin comprobante: no se puede aceptar. Declinala o pedíselo por Instagram.
          </p>
        )}

        {confirmingDecline ? (
          <div className="space-y-3 rounded-control border border-alert/30 bg-alert/[0.06] p-3">
            <p className="text-sm text-bone/85">
              {count > 1
                ? `¿Declinar la compra de ${buyerName}? Se anulan las ${count} entradas, se liberan los lugares y le avisamos por mail a quien compró.`
                : `¿Declinar la transferencia de ${buyerName}? Se libera el lugar y le avisamos por mail.`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={busy}
                onClick={() => setConfirmingDecline(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="lg"
                disabled={busy}
                aria-busy={decision === 'decline'}
                onClick={() => decide('decline')}
              >
                {decision === 'decline' ? 'Declinando…' : 'Sí, declinar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(!receipt && 'col-span-2')}
              disabled={busy}
              onClick={() => setConfirmingDecline(true)}
            >
              Declinar
            </Button>
            {receipt && (
              <Button
                type="button"
                size="lg"
                disabled={busy}
                aria-busy={decision === 'accept'}
                onClick={() => decide('accept')}
              >
                {decision === 'accept' ? 'Aceptando…' : count > 1 ? `Aceptar las ${count}` : 'Aceptar'}
              </Button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}
      </div>
      {viewing &&
        createPortal(
          <ReceiptViewer
            src={receiptUrl}
            buyerName={count > 1 ? `${buyerName} · ${count} entradas` : buyerName}
            totalLabel={totalLabel}
            onClose={closeViewer}
          />,
          document.body,
        )}
    </>
  );
}

// Pantalla completa para leer el comprobante desde el celular: entra entero en la pantalla y
// "Ampliar" (o tocar la imagen) lo agranda para recorrerlo. Arriba, el total esperado para
// compararlo con lo que dice el comprobante.
function ReceiptViewer({
  src,
  buyerName,
  totalLabel,
  onClose,
}: {
  src: string;
  buyerName: string;
  totalLabel: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comprobante de ${buyerName}`}
      className="fixed inset-0 z-50 flex flex-col bg-ink"
    >
      <div className="flex items-center gap-3 border-b border-bone/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{buyerName}</p>
          <p className="text-[13px] text-bone/55">
            Total a transferir <span className="font-bold text-bone">{totalLabel}</span>
          </p>
        </div>
        <Button ref={closeRef} type="button" variant="outline" onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden />
          Cerrar
        </Button>
      </div>

      <div className="relative flex-1 overflow-auto">
        {status === 'loading' && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-bone/50">
            Cargando comprobante…
          </p>
        )}
        {status === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-bone/75">No se pudo mostrar el comprobante acá.</p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              Abrirlo en una pestaña
            </a>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- viene de un link temporal al bucket privado
          <img
            src={src}
            alt={`Comprobante de transferencia de ${buyerName}`}
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
            onClick={() => setZoomed((z) => !z)}
            className={cn(
              'select-none',
              zoomed
                ? 'w-[220%] max-w-none cursor-zoom-out md:w-auto'
                : 'h-full w-full cursor-zoom-in object-contain p-2',
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-bone/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={status !== 'ok'}
          onClick={() => setZoomed((z) => !z)}
        >
          {zoomed ? (
            <ZoomOut size={17} strokeWidth={1.5} aria-hidden />
          ) : (
            <ZoomIn size={17} strokeWidth={1.5} aria-hidden />
          )}
          {zoomed ? 'Ajustar' : 'Ampliar'}
        </Button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
          Abrir en pestaña
        </a>
      </div>
    </div>
  );
}
