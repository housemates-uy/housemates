'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import QrScanner from 'qr-scanner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { checkInByDocumentAction, scanAction, type ScanOutcome } from './actions';

// Pantalla del portero. Lee QRs con la cámara trasera y muestra el resultado a pantalla
// completa: azul = pasa, rojo = no pasa. Siempre muestra nombre y CI para cotejar con el
// documento: el QR prueba que la entrada existe, la cédula prueba que es de esa persona.
const MESSAGES: Record<ScanOutcome['result'], { title: string; ok: boolean }> = {
  admitted: { title: 'Adelante', ok: true },
  already_used: { title: 'Ya usada', ok: false },
  invalid: { title: 'QR inválido', ok: false },
  wrong_event: { title: 'Es de otro evento', ok: false },
  not_paid: { title: 'Entrada no válida', ok: false },
  door_closed: { title: 'Puerta cerrada', ok: false },
  session_expired: { title: 'Sesión vencida: volvé a entrar', ok: false },
  not_found: { title: 'No hay entrada con esa CI', ok: false },
};

export function Scanner({ eventId, initial }: { eventId: string; initial: { inside: number; total: number } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ value: string; at: number } | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [counts, setCounts] = useState(initial);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [doc, setDoc] = useState('');
  const [pending, startTransition] = useTransition();

  const show = useCallback((o: ScanOutcome) => {
    setOutcome(o);
    if (o.total) setCounts({ inside: o.inside, total: o.total });
    if ('vibrate' in navigator) navigator.vibrate(MESSAGES[o.result].ok ? 80 : [120, 60, 120]);
  }, []);

  const onDecode = useCallback(
    async (value: string) => {
      // Ignora el mismo QR durante 4 s: la cámara lo lee varias veces por segundo.
      const now = Date.now();
      if (busyRef.current || (lastRef.current?.value === value && now - lastRef.current.at < 4000)) return;
      busyRef.current = true;
      lastRef.current = { value, at: now };
      try {
        show(await scanAction(eventId, value));
      } finally {
        busyRef.current = false;
      }
    },
    [eventId, show],
  );

  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(videoRef.current, (r) => onDecode(r.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 6,
    });
    scannerRef.current = scanner;
    scanner.start().catch(() => setCameraError('No se pudo abrir la cámara. Revisá los permisos del navegador.'));

    // Que la pantalla no se apague mientras se escanea.
    let wakeLock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});

    return () => {
      scanner.destroy();
      wakeLock?.release().catch(() => {});
    };
  }, [onDecode]);

  // El resultado se cierra solo a los 3 s (o tocando la pantalla).
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => setOutcome(null), 3000);
    return () => clearTimeout(t);
  }, [outcome]);

  const msg = outcome ? MESSAGES[outcome.result] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-bone/55">Entraron</p>
        <p className="text-3xl font-bold tracking-tight">
          {counts.inside}
          <span className="text-bone/40"> / {counts.total}</span>
        </p>
      </div>

      <div className="relative overflow-hidden rounded-card border border-bone/10 bg-black">
        <video ref={videoRef} className="aspect-[3/4] w-full object-cover sm:aspect-video" muted playsInline />
        {cameraError && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-bone/75">
            {cameraError}
          </p>
        )}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!doc.trim()) return;
          startTransition(async () => {
            show(await checkInByDocumentAction(eventId, doc));
            setDoc('');
          });
        }}
      >
        <Field label="Sin QR: buscar por cédula" className="flex-1">
          <Input value={doc} onChange={(e) => setDoc(e.target.value)} inputMode="numeric" autoComplete="off" />
        </Field>
        <Button type="submit" variant="outline" disabled={pending || !doc.trim()}>
          Validar
        </Button>
      </form>

      {outcome && msg && (
        <button
          type="button"
          onClick={() => setOutcome(null)}
          aria-live="assertive"
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center',
            msg.ok ? 'bg-electric text-bone' : 'bg-alert text-bone',
          )}
        >
          <span className="text-5xl font-bold uppercase tracking-tight">{msg.title}</span>
          {outcome.name && <span className="mt-6 text-2xl font-bold">{outcome.name}</span>}
          {outcome.document && <span className="mt-2 text-xl">CI {outcome.document}</span>}
          {(outcome.tier || outcome.invitation) && (
            <span className="mt-2 text-base opacity-80">{outcome.invitation ? 'Invitación' : outcome.tier}</span>
          )}
          {outcome.result === 'already_used' && outcome.usedAt && (
            <span className="mt-4 text-lg">
              Entró a las{' '}
              {new Date(outcome.usedAt).toLocaleTimeString('es-UY', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Montevideo',
                hourCycle: 'h23',
              })}
            </span>
          )}
          {msg.ok && <span className="mt-6 text-sm opacity-80">Cotejá la cédula con el documento</span>}
          <span className="mt-10 text-xs opacity-70">Tocá para seguir</span>
        </button>
      )}
    </div>
  );
}
