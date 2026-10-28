'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import QrScanner from 'qr-scanner';
import { Smartphone, SwitchCamera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/database';
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
// Si se corta internet no es un rechazo: aviso neutro "Sin conexión" y se reintenta.
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

// 'not_paid' según el estado real de la entrada: no pasa, pero el portero sabe qué hacer.
const NOT_PAID: Partial<Record<TicketStatus, { title: string; hint?: string }>> = {
  review: {
    title: 'Transferencia sin validar',
    hint: 'Avisale a un owner: la puede aprobar ahora desde Entradas a confirmar.',
  },
  pending: { title: 'Pago sin confirmar' },
  cancelled: { title: 'Entrada anulada' },
  refunded: { title: 'Entrada reembolsada' },
};

const OFFLINE = 'Sin conexión. Probá de nuevo.';
const FAILED: ScanOutcome = { result: 'error', inside: 0, total: 0 };

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Montevideo',
  });
}

function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

// Llama a una server action sin que una falla tire la pantalla: devuelve null si no hubo
// respuesta (sin señal, timeout, error del servidor). Después de un deploy la acción ya no
// existe en el servidor: Next la resuelve sin resultado (o falla con "Failed to find Server
// Action"). Ahí se recarga la página para tomar la versión nueva, pero solo si el sitio
// responde: sin internet, recargar dejaría al portero sin la pantalla.
async function callServer<T>(action: () => Promise<T>): Promise<T | null> {
  let stale = false;
  try {
    const result = await action();
    if (result !== undefined) return result;
    stale = await siteResponds();
  } catch (err) {
    stale = String(err).includes('Failed to find Server Action');
  }
  if (stale) window.location.reload();
  return null;
}

async function siteResponds() {
  try {
    return (await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })).ok;
  } catch {
    return false;
  }
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
  const cameraRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  // Mientras hay un resultado en pantalla (o una consulta en curso), la cámara sigue prendida
  // pero no procesa QRs.
  const busyRef = useRef(false);
  const lastRef = useRef<{ value: string; at: number } | null>(null);
  // La última consulta (QR o cédula), para "Reintentar" si se cortó la conexión.
  const lookupRef = useRef<(() => Promise<ScanOutcome>) | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [counts, setCounts] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([]);
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [doc, setDoc] = useState('');
  const [pending, startTransition] = useTransition();
  const [doorPending, startDoor] = useTransition();
  const [doorFailed, setDoorFailed] = useState(false);

  const show = useCallback((o: ScanOutcome) => {
    if (o.result === 'error') {
      // Sin overlay: la cámara queda libre para volver a escanear.
      busyRef.current = false;
      if (lastRef.current) lastRef.current.at = Date.now();
      setOffline(true);
      vibrate(250);
      return;
    }
    busyRef.current = true;
    setOffline(false);
    setOutcome(o);
    if (o.total) setCounts({ inside: o.inside, total: o.total });
    vibrate(o.result !== 'valid' ? [120, 60, 120] : o.late ? [60, 80, 60] : 60);
  }, []);

  // Cierra el resultado y vuelve a escanear. Ignora el mismo QR 3 s más, por si sigue
  // delante de la cámara.
  const close = useCallback(() => {
    if (lastRef.current) lastRef.current.at = Date.now();
    setOutcome(null);
    setOffline(false);
    busyRef.current = false;
  }, []);

  const lookup = useCallback(
    async (action: () => Promise<ScanOutcome>) => {
      busyRef.current = true;
      lookupRef.current = action;
      setChecking(true);
      const r = await callServer(action);
      setChecking(false);
      show(r ?? FAILED);
    },
    [show],
  );

  const onDecode = useCallback(
    (value: string) => {
      const now = Date.now();
      if (busyRef.current || (lastRef.current?.value === value && now - lastRef.current.at < 3000)) return;
      lastRef.current = { value, at: now };
      lookup(() => inspectAction(eventId, value));
    },
    [eventId, lookup],
  );

  const startCamera = useCallback((scanner: QrScanner) => {
    setCameraError(false);
    scanner.start().then(
      () => {
        QrScanner.listCameras(true)
          .then((list) => {
            if (scannerRef.current === scanner) setCameras(list);
          })
          .catch(() => {});
      },
      () => {
        if (scannerRef.current === scanner) setCameraError(true);
      },
    );
  }, []);

  useEffect(() => {
    const box = cameraRef.current;
    if (!box) return;
    // Un <video> por escáner: qr-scanner corta el stream de su <video> 300 ms después de
    // destruirse. Con uno compartido, el montaje doble de React en desarrollo cortaba la
    // cámara del escáner nuevo.
    const video = document.createElement('video');
    video.className = 'h-full w-full object-cover';
    video.muted = true;
    video.playsInline = true;
    box.prepend(video);
    const scanner = new QrScanner(video, (r) => onDecode(r.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 6,
    });
    scannerRef.current = scanner;
    startCamera(scanner);

    // Que la pantalla no se apague mientras se trabaja en puerta. El celular suelta el wake
    // lock cuando la pestaña pasa a segundo plano: al volver se pide de nuevo.
    let wakeLock: WakeLockSentinel | null = null;
    let disposed = false;
    const keepAwake = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        ?.request('screen')
        .then((w) => {
          if (disposed) w.release().catch(() => {});
          else wakeLock = w;
        })
        .catch(() => {});
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', keepAwake);
      scannerRef.current = null;
      scanner.destroy();
      scanner.$overlay?.remove();
      video.remove();
      wakeLock?.release().catch(() => {});
    };
  }, [onDecode, startCamera]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Pasa a la cámara siguiente de la lista (en muchos celulares hay varias traseras).
  function switchCamera() {
    const scanner = scannerRef.current;
    if (!scanner || cameras.length < 2) return;
    const stream = scanner.$video.srcObject;
    const current = stream instanceof MediaStream ? stream.getVideoTracks()[0]?.getSettings().deviceId : undefined;
    const next = cameras[(cameras.findIndex((c) => c.id === current) + 1) % cameras.length];
    scanner.setCamera(next.id).catch(() => setCameraError(true));
  }

  function retryLookup() {
    if (lookupRef.current) lookup(lookupRef.current);
  }

  function confirm() {
    if (!outcome?.token) return;
    const token = outcome.token;
    setOffline(false);
    startTransition(async () => {
      const r = await callServer(() => confirmAction(eventId, token));
      if (!r || r.result === 'error') {
        // La pantalla azul queda con el aviso: el mismo botón reintenta.
        setOffline(true);
        vibrate(250);
      } else if (r.result === 'admitted') {
        if (r.total) setCounts({ inside: r.inside, total: r.total });
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
    // Solo registra el intento: si falla la conexión no cambia nada para el portero.
    if (ticketId) rejectAction(eventId, ticketId).catch(() => {});
  }

  const notPaid = outcome?.result === 'not_paid' && outcome.status ? NOT_PAID[outcome.status] : undefined;
  const rejectTitle =
    outcome && outcome.result !== 'valid' ? (notPaid?.title ?? REJECT_TITLES[outcome.result] ?? 'No pasa') : null;
  const rejectHint = outcome && (notPaid ? notPaid.hint : REJECT_HINTS[outcome.result]);
  // "Transferencia" o "reembolsada" no entran en un celular con el tamaño de siempre.
  const longTitle = !!rejectTitle?.split(' ').some((word) => word.length > 10);

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

      {/* Cámara: ocupa todo el espacio libre. El <video> lo agrega el efecto. */}
      <div ref={cameraRef} className="relative min-h-0 flex-1 bg-black">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-bone/75">No se pudo abrir la cámara. Revisá los permisos del navegador.</p>
            <Button
              variant="outline"
              onClick={() => scannerRef.current && startCamera(scannerRef.current)}
              className="h-12 px-6"
            >
              Reintentar
            </Button>
          </div>
        ) : (
          cameras.length > 1 && (
            <button
              type="button"
              onClick={switchCamera}
              className="absolute right-3 top-3 flex h-11 items-center gap-2 rounded-full bg-ink/70 px-4 text-sm font-medium backdrop-blur-sm"
            >
              <SwitchCamera size={18} aria-hidden />
              Cambiar cámara
            </button>
          )
        )}
        {offline && !outcome ? (
          <div
            role="alert"
            className="absolute inset-x-4 bottom-4 rounded-card border border-bone/25 bg-ink/90 p-4 text-center backdrop-blur-sm"
          >
            <p className="text-base font-bold">{OFFLINE}</p>
            <Button variant="outline" onClick={retryLookup} disabled={checking} className="mt-3 h-12 w-full">
              {checking ? 'Probando...' : 'Reintentar'}
            </Button>
          </div>
        ) : (
          !cameraError && (
            <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-bone/80">
              {checking ? 'Consultando...' : 'Apuntá al QR de la entrada'}
            </p>
          )
        )}
        {toast && (
          <p
            role="status"
            className="absolute inset-x-4 top-4 z-10 rounded-control bg-electric px-4 py-3 text-center text-sm font-medium"
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
            if (!doc.trim() || checking) return;
            const value = doc;
            setDoc('');
            (document.activeElement as HTMLElement | null)?.blur();
            lookup(() => inspectByDocumentAction(eventId, value));
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
          <Button type="submit" variant="outline" disabled={checking || !doc.trim()}>
            Buscar
          </Button>
        </form>
        {isOwner && (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              disabled={doorPending}
              onClick={() =>
                startDoor(async () => {
                  setDoorFailed(false);
                  const r = await callServer(() => toggleDoorAction(eventId, doorClosed));
                  if (!r?.ok) setDoorFailed(true);
                })
              }
              className="text-xs text-bone/50 underline-offset-4 hover:underline disabled:opacity-50"
            >
              {doorClosed ? 'Reabrir puerta' : 'Cerrar puerta'}
            </button>
            {doorFailed && <p className="text-xs text-alert">Sin conexión. Probá de nuevo.</p>}
          </div>
        )}
      </footer>

      {/* Resultado: entrada válida → cotejar cédula y confirmar */}
      {outcome?.result === 'valid' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-electric px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {/* Tanda de ingreso temprano escaneada después de su horario: solo avisa. */}
            {outcome.late && (
              <div role="alert" className="mb-8 w-full rounded-card border-2 border-bone bg-ink px-5 py-4">
                <p className="text-2xl font-bold uppercase leading-none tracking-tight">Fuera de horario</p>
                <p className="mt-2 text-base">Era ingreso hasta {outcome.entryUntil}</p>
                <p className="mt-1 text-sm text-bone/70">Decidí vos si pasa: podés confirmar el ingreso igual.</p>
              </div>
            )}
            <p className="text-sm font-bold uppercase tracking-label opacity-80">Entrada válida</p>
            <p className="mt-6 text-4xl font-bold leading-tight">{outcome.name}</p>
            <p className="mt-4 text-sm opacity-80">Cédula</p>
            <p className="text-4xl font-bold tracking-tight">{outcome.document}</p>
            <p className="mt-4 text-base opacity-85">
              {outcome.invitation ? 'Invitación' : outcome.tier}
              {outcome.entryUntil && !outcome.late && ` · Ingreso hasta ${outcome.entryUntil}`}
            </p>
            {offline ? (
              <p role="alert" className="mt-10 w-full rounded-card bg-ink px-5 py-4 text-base font-bold">
                {OFFLINE}
              </p>
            ) : (
              <p className="mt-10 max-w-[28ch] text-base font-medium">
                Pedí la cédula y verificá que el nombre y el número coincidan.
              </p>
            )}
          </div>
          <div className="grid gap-3">
            <Button size="lg" onClick={confirm} disabled={pending} className="h-14 text-base">
              {pending ? 'Confirmando...' : offline ? 'Reintentar' : 'Coincide, confirmar ingreso'}
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
            <p
              className={cn(
                'mt-8 font-bold uppercase leading-none tracking-tight',
                longTitle ? 'text-[min(3rem,10vw)]' : 'text-5xl',
              )}
            >
              {rejectTitle}
            </p>
            {outcome.result === 'already_used' && outcome.usedAt && (
              <p className="mt-4 text-xl">Entró a las {timeOf(outcome.usedAt)}</p>
            )}
            {rejectHint && <p className="mt-4 text-base">{rejectHint}</p>}
            {outcome.name && <p className="mt-8 text-2xl font-bold">{outcome.name}</p>}
            {outcome.document && <p className="mt-1 text-lg">CI {outcome.document}</p>}
          </div>
          <Button size="lg" variant="outline" onClick={close} className="h-14 border-bone/60 text-base">
            Cerrar
          </Button>
        </div>
      )}
    </main>
  );
}
