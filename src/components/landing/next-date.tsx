import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Reveal } from '@/components/ui/reveal';
import type { NextEvent } from '@/lib/next-event';
import { cn } from '@/lib/utils';

// El lugar es secreto (§3): en la portada nunca llega del servidor, solo este rótulo.
function SecretLocation() {
  return (
    <span className="inline-flex items-center gap-2 uppercase tracking-[0.14em]">
      <Lock size={14} strokeWidth={2} aria-hidden className="shrink-0 text-violet" />
      Secret location
    </span>
  );
}

// Las tandas y los precios se ven recién en /entradas: acá solo la fecha y el botón para ir.
// Sin evento no hay formato: la fila no va (nunca se inventa).
export function NextDate({ event }: { event: NextEvent }) {
  const details: [string, React.ReactNode][] = [
    // Espacio de no corte: "23:59 hs" no se parte en dos renglones.
    ['Cuándo', event.id ? `${event.weekday} ${event.dateLong} · ${event.time} hs` : 'A confirmar'],
    ...(event.format ? [['Formato', event.format] as [string, React.ReactNode]] : []),
    ['Dónde', event.id ? <SecretLocation key="d" /> : 'A confirmar'],
  ];

  return (
    <section id="fecha" className="border-t border-bone/10">
      <div className="mx-auto grid max-w-page gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[1.25fr_1fr] lg:gap-20">
        <Reveal>
          <Eyebrow>Próxima fecha</Eyebrow>
          {event.id ? (
            <p className="mt-5 text-[clamp(4rem,17vw,12rem)] font-bold leading-[0.85] tracking-[-0.04em]">
              {event.dateShort}
            </p>
          ) : (
            <p className="mt-5 text-[clamp(3rem,13vw,8rem)] font-bold leading-[0.9] tracking-[-0.04em]">
              A confirmar
            </p>
          )}
          <span
            aria-hidden
            className="mt-8 block h-px w-24 bg-electric shadow-[0_0_18px_2px_rgba(36,71,245,0.7)]"
          />
          {event.description && (
            <p className="mt-8 max-w-[46ch] whitespace-pre-line text-base leading-relaxed text-bone/65">
              {event.description}
            </p>
          )}
        </Reveal>

        <Reveal delay={0.1} className="flex min-w-0 flex-col justify-end">
          <dl className="divide-y divide-bone/10 border-y border-bone/10">
            {details.map(([term, value]) => (
              <div key={term} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-4">
                <dt className="text-sm text-bone/55">{term}</dt>
                <dd className="min-w-0 text-sm font-medium first-letter:uppercase">{value}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/entradas"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'group mt-10 h-[4.5rem] w-full justify-between rounded-card px-6 md:h-20 md:px-8',
            )}
          >
            <span className="flex flex-col items-start leading-none">
              <span className="text-2xl font-bold tracking-[-0.02em] md:text-[1.75rem]">
                Entradas
              </span>
              <span className="mt-1.5 text-[13px] font-medium text-ink/60">Tandas y precios</span>
            </span>
            <ArrowRight
              size={26}
              strokeWidth={1.75}
              aria-hidden
              className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
