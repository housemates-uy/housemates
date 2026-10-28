'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import QrScanner from 'qr-scanner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import {
  deliverBarUnitAction,
  inspectBarUnitAction,
  searchBarAction,
  type BarScanOutcome,
  type BarUnitView,
} from './actions';

// Pantalla del barman, pensada como app de celular (pantalla completa, sin scroll).
// Cada QR es un trago:
//   1. Escanea el QR → ve qué trago es. Todavía no cambió nada.
//   2. "Entregar" → recién ahí el QR queda usado. Si otro barman lo entregó justo antes,
//      aparece "Ya entregado" con la hora.
// Sin QR: el email muestra los tragos pendientes de esa persona para entregarlos a mano.
// Como en la puerta, los resultados quedan en pantalla hasta que el barman decide.
const REJECT_TITLES: Partial<Record<BarScanOutcome['result'], string>> = {
  already_delivered: 'Ya entregado',
  invalid: 'QR inválido',
  wrong_event: 'Es de otro evento',
  not_paid: 'Pedido sin pagar',
  is_ticket: 'Es una entrada',
  all_delivered: 'Ya retiró todo',
  not_found: 'No hay tragos con ese email',
  session_expired: 'Sesión vencida: volvé a entrar',
};

const REJECT_HINTS: Partial<Record<BarScanOutcome['result'], string>> = {
  invalid: 'Este QR no corresponde a ningún trago.',
  not_paid: 'El pago no se confirmó o el pedido se anuló.',
  is_ticket: 'Ese QR es de una entrada, no de un trago de barra.',
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Montevideo',
  });
}

export function BarScannerApp({
  eventId,
  title,
  initial,
}: {
  eventId: string;
  title: string;
  initial: { delivered: number; sold: number };
}) {
  const cameraRef = useRef<HTMLDivElement>(null);
  // Mientras hay un resultado en pantalla, la cámara sigue prendida pero no procesa QRs.
  const busyRef = useRef(false);
  const lastRef = useRef<{ value: string; at: number } | null>(null);
  const [outcome, setOutcome] = useState<BarScanOutcome | null>(null);
  const [counts, setCounts] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  const show = useCallback((o: BarScanOutcome) => {
    busyRef.current = true;
    setOutcome(o);
    if (o.sold) setCounts({ delivered: o.delivered, sold: o.sold });
    if ('vibrate' in navigator) navigator.vibrate(o.result === 'valid' || o.result === 'list' ? 60 : [120, 60, 120]);
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
      show(await inspectBarUnitAction(eventId, value));
    },
    [eventId, show],
  );

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
    scanner.start().catch(() => setCameraError('No se pudo abrir la cámara. Revisá los permisos o buscá por email.'));

    // Que la pantalla no se apague mientras se trabaja en la barra.
    let wakeLock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});

    return () => {
      scanner.destroy();
      scanner.$overlay?.remove();
      video.remove();
      wakeLock?.release().catch(() => {});
    };
  }, [onDecode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Entregar el QR escaneado: si sale bien vuelve a la cámara; si no, muestra el motivo.
  function deliverScanned(unit: BarUnitView) {
    startTransition(async () => {
      const r = await deliverBarUnitAction(eventId, unit.token);
      if (r.result === 'delivered') {
        setCounts({ delivered: r.delivered, sold: r.sold });
        setToast(`Entregado: ${unit.name}`);
        close();
      } else {
        show(r);
      }
    });
  }

  // Entregar desde la búsqueda por email: la lista sigue abierta con lo que falta.
  function deliverFromList(unit: BarUnitView) {
    startTransition(async () => {
      const r = await deliverBarUnitAction(eventId, unit.token);
      if (r.sold) setCounts({ delivered: r.delivered, sold: r.sold });
      setOutcome((prev) => {
        if (!prev?.matches) return prev;
        return { ...prev, matches: prev.matches.filter((m) => m.token !== unit.token) };
      });
      setToast(r.result === 'delivered' ? `Entregado: ${unit.name}` : `${unit.name}: ya estaba entregado`);
    });
  }

  const rejectTitle =
    outcome && outcome.result !== 'valid' && outcome.result !== 'list' ? REJECT_TITLES[outcome.result] ?? 'No se entrega' : null;

  return (
    <main className="fixed inset-0 flex flex-col bg-ink">
      {/* Barra superior: salir, evento y contador */}
      <header className="flex items-center gap-3 border-b border-bone/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={`/admin/events/${eventId}/barra`}
          aria-label="Salir del escáner de barra"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-control text-bone/70"
        >
          <X size={20} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-bone/50">Barra · tragos entregados</p>
        </div>
        <p className="text-right" aria-label={`${counts.delivered} de ${counts.sold} tragos entregados`}>
          <span className="text-2xl font-bold tracking-tight">{counts.delivered}</span>
          <span className="text-sm text-bone/45"> / {counts.sold}</span>
        </p>
      </header>

      {/* Cámara: ocupa todo el espacio libre */}
      <div ref={cameraRef} className="relative min-h-0 flex-1 bg-black">
        {cameraError ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-bone/75">
            {cameraError}
          </p>
        ) : (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-bone/80">
            Apuntá al QR del trago
          </p>
        )}
        {toast && (
          <p
            role="status"
            className="absolute inset-x-4 top-4 z-[60] rounded-control bg-electric px-4 py-3 text-center text-sm font-medium"
          >
            {toast}
          </p>
        )}
      </div>

      {/* Plan B: email o código del QR */}
      <footer className="border-t border-bone/10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!query.trim()) return;
            const value = query;
            setQuery('');
            (document.activeElement as HTMLElement | null)?.blur();
            startTransition(async () => show(await searchBarAction(eventId, value)));
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            inputMode="email"
            placeholder="Sin QR: email o código"
            aria-label="Buscar tragos por email o código del QR"
          />
          <Button type="submit" variant="outline" disabled={pending || !query.trim()}>
            Buscar
          </Button>
        </form>
      </footer>

      {/* Resultado: trago válido → entregar */}
      {outcome?.result === 'valid' && outcome.unit && (
        <div className="fixed inset-0 z-50 flex flex-col bg-electric px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-bold uppercase tracking-label opacity-80">Para entregar</p>
            <p className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight">{outcome.unit.name}</p>
            {outcome.unit.buyer && <p className="mt-6 text-base opacity-85">{outcome.unit.buyer}</p>}
          </div>
          <div className="grid gap-3">
            <Button
              size="lg"
              onClick={() => deliverScanned(outcome.unit!)}
              disabled={pending}
              className="h-16 text-lg"
            >
              {pending ? 'Entregando...' : 'Entregar'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={close}
              disabled={pending}
              className="h-14 border-bone/50 text-base"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Búsqueda por email: tragos pendientes de esa persona */}
      {outcome?.result === 'list' && outcome.matches && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
          <p className="text-xs font-bold uppercase tracking-label text-bone/50">Tragos para retirar</p>
          <p className="mt-2 truncate text-lg font-bold">{outcome.buyer ?? outcome.email}</p>
          {outcome.buyer && outcome.buyer !== outcome.email && (
            <p className="truncate text-sm text-bone/55">{outcome.email}</p>
          )}
          {outcome.matches.length === 0 && (
            <p className="mt-10 flex-1 text-center text-2xl font-bold">Ya retiró todo</p>
          )}
          <ul className="mt-5 min-h-0 flex-1 divide-y divide-bone/10 overflow-y-auto border-y border-bone/10 empty:hidden">
            {outcome.matches.map((m) => (
              <li key={m.token} className="flex items-center justify-between gap-4 py-4">
                <p className="min-w-0 text-xl font-bold leading-tight">{m.name}</p>
                <Button onClick={() => deliverFromList(m)} disabled={pending} className="h-12 shrink-0 px-6">
                  Entregar
                </Button>
              </li>
            ))}
          </ul>
          <Button size="lg" variant="outline" onClick={close} className="mt-4 h-14 border-bone/50 text-base">
            Listo
          </Button>
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
            {outcome.result === 'already_delivered' && outcome.unit?.deliveredAt && (
              <p className="mt-4 text-xl">a las {timeOf(outcome.unit.deliveredAt)}</p>
            )}
            {REJECT_HINTS[outcome.result] && <p className="mt-4 text-base">{REJECT_HINTS[outcome.result]}</p>}
            {outcome.unit && outcome.result !== 'invalid' && (
              <p className="mt-8 text-2xl font-bold">{outcome.unit.name}</p>
            )}
            {outcome.unit?.buyer && <p className="mt-1 text-lg">{outcome.unit.buyer}</p>}
            {outcome.email && <p className="mt-6 text-lg">{outcome.email}</p>}
          </div>
          <Button size="lg" variant="outline" onClick={close} className="h-14 border-bone/60 text-base">
            Cerrar
          </Button>
        </div>
      )}
    </main>
  );
}
