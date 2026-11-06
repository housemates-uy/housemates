'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type Unit = { token: string; name: string; deliveredAt: string | null; svg: string | null };

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Montevideo',
  });
}

// La página se refresca sola cada 5 s y en cada refresco Next vuelve a montar este componente.
// El trago que se está mirando se guarda acá (por pedido) para no volver al primero.
const viewing = new Map<string, number>();
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Un QR grande por vez, deslizable de costado (scroll-snap, sin librerías). Al abrir se para
// en el primer trago para retirar. Abajo, un número por trago para saltar directo: tachado si
// ya se entregó. Cuando el barman entrega, ese QR pasa a "Entregado" sin perder el lugar.
// Impreso (Guardar PDF) salen todos uno abajo del otro.
export function UnitsCarousel({ units }: { units: Unit[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const key = units[0]?.token ?? '';
  const [current, setCurrent] = useState(
    () => viewing.get(key) ?? Math.max(0, units.findIndex((u) => !u.deliveredAt)),
  );

  // Solo al montar, antes de pintar: después la persona decide dónde está parada.
  useIsoLayoutEffect(() => {
    const track = trackRef.current;
    if (track && current > 0) track.scrollLeft = current * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(units.length - 1, i));
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  }

  return (
    <section aria-label="Tus QRs" className="mt-7 w-full">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const t = e.currentTarget;
          const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
          viewing.set(key, i);
          setCurrent(i);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] print:flex-col print:gap-6 print:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {units.map((u, i) => (
          <article
            key={u.token}
            aria-label={`Trago ${i + 1} de ${units.length}: ${u.name}`}
            className="w-full shrink-0 snap-center px-0.5 print:break-inside-avoid"
          >
            <div
              className={cn(
                'flex flex-col items-center rounded-[22px] border p-5 print:border-ink/30 print:bg-white',
                u.deliveredAt ? 'border-bone/10 bg-ink/40' : 'border-bone/25 bg-ink/60',
              )}
            >
              <div className="flex w-full items-center justify-between text-xs text-bone/65">
                <span>
                  Trago {i + 1} de {units.length}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-bone">
                  <span
                    aria-hidden
                    className={cn('h-2 w-2 rounded-full', u.deliveredAt ? 'bg-bone/40' : 'bg-violet')}
                  />
                  {u.deliveredAt ? 'Entregado' : 'Para retirar'}
                </span>
              </div>
              <p className="mt-4 text-center text-[1.75rem] font-bold leading-tight tracking-tight">{u.name}</p>

              {u.svg ? (
                <div className="mt-5 rounded-[14px] bg-white p-3">
                  <div
                    role="img"
                    aria-label={`Código QR de ${u.name}`}
                    className="aspect-square w-[min(260px,64vw,34dvh)] [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: u.svg }}
                  />
                </div>
              ) : (
                <div className="mt-5 flex aspect-square w-[min(284px,70vw,38dvh)] flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-bone/20 text-center">
                  <Check size={40} strokeWidth={1.5} aria-hidden className="text-bone/70" />
                  <p className="text-xl font-bold">Entregado</p>
                  {u.deliveredAt && <p className="text-sm text-bone/60">a las {timeOf(u.deliveredAt)}</p>}
                </div>
              )}

              {!u.deliveredAt && (
                <a
                  href={`/barra/qr/${u.token}/imagen`}
                  download
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-control px-3 text-sm text-bone/75 hover:text-bone print:hidden"
                >
                  <Download size={16} strokeWidth={1.5} aria-hidden />
                  Guardar este QR
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {units.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Trago anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-bone/20 disabled:opacity-30"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <ol className="flex flex-wrap justify-center gap-1.5">
            {units.map((u, i) => (
              <li key={u.token}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Ir al trago ${i + 1}: ${u.name}${u.deliveredAt ? ', entregado' : ''}`}
                  aria-current={i === current ? 'true' : undefined}
                  className={cn(
                    'flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums transition-colors',
                    i === current ? 'bg-bone text-ink' : 'border border-bone/20 text-bone/80',
                    u.deliveredAt && i !== current && 'text-bone/35 line-through',
                  )}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === units.length - 1}
            aria-label="Trago siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-bone/20 disabled:opacity-30"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}

// Guardar todos los QRs: diálogo de impresión → "Guardar como PDF" (sale en blanco y negro).
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-5 flex h-11 items-center justify-center gap-2 rounded-control border border-bone/25 px-4 text-sm text-bone/85 transition-colors hover:border-bone hover:text-bone print:hidden"
    >
      <FileText size={16} strokeWidth={1.5} aria-hidden />
      Guardar todos en PDF
    </button>
  );
}
