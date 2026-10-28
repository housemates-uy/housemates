'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import QrScanner from 'qr-scanner';
import { Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import {
  confirmAction,
  inspectAction,
  inspectByDocumentAction,
  rejectAction,
  toggleDoorAction,
  type ScanOutcome,
} from './actions';

// Pantalla del portero, pensada como app de celular (pantalla completa, sin scroll).
//
// Flujo de cada persona:
//   1. Escanea el QR (o escribe la CI) → se muestran sus datos. Todavía no entró.
//   2. El portero le pide la cédula y la compara con lo que ve en pantalla:
//        coincide    → "Confirmar ingreso" → recién ahí la entrada queda usada.
//        no coincide → "Cancelar" → no cambia nada (queda registrado el intento).
//   Los rechazos (ya usada, inválida, etc.) quedan en pantalla hasta tocar "Cerrar".
// Nada se cierra solo: el portero siempre decide cuándo seguir.
const REJECT_TITLES: Partial<Record<ScanOutcome['result'], string>> = {
  already_used: 'Ya usada',
  invalid: 'QR inválido',
  wrong_event: 'Es de otro evento',
  not_paid: 'Entrada no válida',
  door_closed: 'Puerta cerrada',
  not_found: 'No hay entrada con esa CI',
  session_expired: 'Sesión vencida: volvé a entrar',
};

const REJECT_HINTS: Partial<Record<ScanOutcome['result'], string>> = {
  not_paid: 'Está anulada o el pago no se confirmó.',
  invalid: 'Este QR no corresponde a ninguna entrada.',
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Montevideo',
  });
}

export function ScannerApp({
  eventId,
  title,
  doorClosed,
  isOwner,
  initial,
}: {
  eventId: string;
  title: string;
  doorClosed: boolean;
  isOwner: boolean;
  initial: { inside: number; total: number };
}) {
  // El scanner es solo para celular: en la compu se muestra un aviso.
  const [isPhone, setIsPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    setIsPhone(touch && Math.min(window.screen.width, window.screen.height) < 900);
  }, []);

  if (isPhone === null) return <div className="h-[100dvh] bg-ink" />;
  if (!isPhone) {
    return (
      <main className="flex h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center">
        <Smartphone size={40} strokeWidth={1.25} aria-hidden />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usalo desde el celular</h1>
          <p className="mt-2 max-w-[36ch] text-sm text-bone/60">
            La puerta se maneja con la cámara del celular. Entrá al admin desde el teléfono y abrí
            Eventos → {title} → Puerta.
          </p>
        </div>
        <Link href={`/admin/events/${eventId}`} className="text-sm text-bone/60 underline-offset-4 hover:underline">
          Volver al evento
        </Link>
      </main>
    );
  }

  return <Door eventId={eventId} title={title} doorClosed={doorClosed} isOwner={isOwner} initial={initial} />;
}

function Door({
  eventId,
  title,
  doorClosed,
  isOwner,
  initial,
}: {
  eventId: string;
  title: string;
  doorClosed: boolean;
  isOwner: boolean;
  initial: { inside: number; total: number };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Mientras hay un resultado en pantalla, la cámara sigue prendida pero no procesa QRs.
  const busyRef = useRef(false);
  const lastRef = useRef<{ value: string; at: number } | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [counts, setCounts] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [doc, setDoc] = useState('');
  const [pending, startTransition] = useTransition();

  const show = useCallback((o: ScanOutcome) => {
    busyRef.current = true;
    setOutcome(o);
    if (o.total) setCounts({ inside: o.inside, total: o.total });
    if ('vibrate' in navigator) navigator.vibrate(o.result === 'valid' ? 60 : [120, 60, 120]);
  }, []);

  // Cierra el resultado y vuelve a escanear. Ignora el mismo QR 3 s más, por si sigue
  // delante de la cámara.
  const close = useCallback(() => {
    if (lastRef.current) lastRef.current.at = Date.now();
    setOutcome(null);
    busyRef.current = false;
  }, []);

  const onDecode = useCallback(
    async (value: string) => {
      const now = Date.now();
      if (busyRef.current || (lastRef.current?.value === value && now - lastRef.current.at < 3000)) return;
      busyRef.current = true;
      lastRef.current = { value, at: now };
      show(await inspectAction(eventId, value));
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
    scanner.start().catch(() => setCameraError('No se pudo abrir la cámara. Revisá los permisos del navegador.'));

    // Que la pantalla no se apague mientras se trabaja en puerta.
    let wakeLock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});

    return () => {
      scanner.destroy();
      wakeLock?.release().catch(() => {});
    };
  }, [onDecode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function confirm() {
    if (!outcome?.token) return;
    const token = outcome.token;
    startTransition(async () => {
      const r = await confirmAction(eventId, token);
      if (r.result === 'admitted') {
        setCounts({ inside: r.inside, total: r.total });
        setToast(`Ingresó ${r.name ?? ''}`);
        close();
      } else {
        // Otro portero la confirmó justo antes, o cerraron la puerta.
        show(r);
      }
    });
  }

  function reject() {
    const ticketId = outcome?.ticketId;
    close();
    if (ticketId) startTransition(() => rejectAction(eventId, ticketId));
  }

  const rejectTitle = outcome && outcome.result !== 'valid' ? REJECT_TITLES[outcome.result] ?? 'No pasa' : null;

  return (
    <main className="fixed inset-0 flex flex-col bg-ink">
      {/* Barra superior: salir, evento y contador */}
      <header className="flex items-center gap-3 border-b border-bone/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={`/admin/events/${eventId}`}
          aria-label="Salir de la puerta"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-control text-bone/70"
        >
          <X size={20} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-bone/50">{doorClosed ? 'Puerta cerrada' : 'Puerta abierta'}</p>
        </div>
        <p className="text-right">
          <span className="text-2xl font-bold tracking-tight">{counts.inside}</span>
          <span className="text-sm text-bone/45"> / {counts.total}</span>
        </p>
      </header>

      {/* Cámara: ocupa todo el espacio libre */}
      <div className="relative min-h-0 flex-1 bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {cameraError ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-bone/75">
            {cameraError}
          </p>
        ) : (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-bone/80">
            Apuntá al QR de la entrada
          </p>
        )}
        {toast && (
          <p
            role="status"
            className="absolute inset-x-4 top-4 rounded-control bg-electric px-4 py-3 text-center text-sm font-medium"
          >
            {toast}
          </p>
        )}
      </div>

      {/* Plan B por cédula + cerrar puerta */}
      <footer className="space-y-3 border-t border-bone/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!doc.trim()) return;
            const value = doc;
            setDoc('');
            (document.activeElement as HTMLElement | null)?.blur();
            startTransition(async () => show(await inspectByDocumentAction(eventId, value)));
          }}
        >
          <Input
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Sin QR: cédula"
            aria-label="Buscar entrada por cédula"
          />
          <Button type="submit" variant="outline" disabled={pending || !doc.trim()}>
            Buscar
          </Button>
        </form>
        {isOwner && (
          <form action={toggleDoorAction.bind(null, eventId, doorClosed)} className="flex justify-center">
            <button type="submit" className="text-xs text-bone/50 underline-offset-4 hover:underline">
              {doorClosed ? 'Reabrir puerta' : 'Cerrar puerta'}
            </button>
          </form>
        )}
      </footer>

      {/* Resultado: entrada válida → cotejar cédula y confirmar */}
      {outcome?.result === 'valid' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-electric px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-bold uppercase tracking-label opacity-80">Entrada válida</p>
            <p className="mt-6 text-4xl font-bold leading-tight">{outcome.name}</p>
            <p className="mt-4 text-sm opacity-80">Cédula</p>
            <p className="text-4xl font-bold tracking-tight">{outcome.document}</p>
            <p className="mt-4 text-base opacity-85">{outcome.invitation ? 'Invitación' : outcome.tier}</p>
            <p className="mt-10 max-w-[28ch] text-base font-medium">
              Pedí la cédula y verificá que el nombre y el número coincidan.
            </p>
          </div>
          <div className="grid gap-3">
            <Button size="lg" onClick={confirm} disabled={pending} className="h-14 text-base">
              {pending ? 'Confirmando...' : 'Coincide, confirmar ingreso'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={reject}
              disabled={pending}
              className="h-14 border-bone/50 text-base"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Resultado: rechazo → queda hasta tocar Cerrar */}
      {rejectTitle && outcome && (
        <div
          role="alert"
          className="fixed inset-0 z-50 flex flex-col bg-alert px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        >
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Logo className="h-12 opacity-80" />
            <p className="mt-8 text-5xl font-bold uppercase leading-none tracking-tight">{rejectTitle}</p>
            {outcome.result === 'already_used' && outcome.usedAt && (
              <p className="mt-4 text-xl">Entró a las {timeOf(outcome.usedAt)}</p>
            )}
            {REJECT_HINTS[outcome.result] && <p className="mt-4 text-base">{REJECT_HINTS[outcome.result]}</p>}
            {outcome.name && <p className="mt-8 text-2xl font-bold">{outcome.name}</p>}
            {outcome.document && <p className="mt-1 text-lg">CI {outcome.document}</p>}
          </div>
          <Button size="lg" variant="outline" onClick={close} className={cn('h-14 border-bone/60 text-base')}>
            Cerrar
          </Button>
        </div>
      )}
    </main>
  );
}
