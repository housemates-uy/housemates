import Link from 'next/link';
import { ArrowRight, Lock, MapPin } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Reveal } from '@/components/ui/reveal';
import { mapsUrl, type NextEvent } from '@/lib/next-event';
import { cn } from '@/lib/utils';

// Sin acceso, el lugar ya viene sin nombre ni link desde el servidor: acá va un texto de relleno
// desenfocado (no es el lugar) y el link para entrar con la contraseña o el código.
function LockedLocation() {
  return (
    <span className="flex flex-col items-start gap-2">
      <span aria-hidden className="select-none blur-[5px]">
        Dirección reservada para la casa
      </span>
      <Link
        href="/access?next=%2F%23fecha"
        className="inline-flex items-center gap-1.5 font-normal text-bone/70 underline decoration-bone/30 underline-offset-4 transition-colors hover:text-bone hover:decoration-bone"
      >
        <Lock size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-violet" />
        Se ve al entrar con la contraseña o tu código
      </Link>
    </span>
  );
}

// Las tandas y los precios se ven recién en /entradas: acá solo la fecha y el botón para ir.
// Sin evento no hay formato: la fila no va (nunca se inventa).
export function NextDate({ event, locked }: { event: NextEvent; locked: boolean }) {
  const details: [string, React.ReactNode][] = [
    // Espacio de no corte: "23:59 hs" no se parte en dos renglones.
    ['Cuándo', event.id ? `${event.weekday} ${event.dateLong} · ${event.time} hs` : 'A confirmar'],
    ...(event.format ? [['Formato', event.format] as [string, React.ReactNode]] : []),
    [
      'Dónde',
      event.id && locked ? (
        <LockedLocation key="d" />
      ) : event.id && event.locationName ? (
        <a
          key="d"
          href={mapsUrl(event.locationName, event.locationUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 underline decoration-bone/30 underline-offset-4 transition-colors hover:decoration-bone"
        >
          <MapPin size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-violet" />
          {event.locationName}
          <span className="sr-only"> (abre Google Maps)</span>
        </a>
      ) : (
        'A confirmar'
      ),
    ],
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
            <p className="mt-5 text-[clamp(3rem,13vw,8rem)] font-bold leading-[0.9] tracking-[-0.04em]">A confirmar</p>
          )}
          <span aria-hidden className="mt-8 block h-px w-24 bg-electric shadow-[0_0_18px_2px_rgba(36,71,245,0.7)]" />
          {event.description && (
            <p className="mt-8 max-w-[46ch] whitespace-pre-line text-base leading-relaxed text-bone/65">
              {event.description}
            </p>
          )}
        </Reveal>

        <Reveal delay={0.1} className="flex flex-col justify-end">
          <dl className="divide-y divide-bone/10 border-y border-bone/10">
            {details.map(([term, value]) => (
              <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-4 py-4">
                <dt className="text-sm text-bone/55">{term}</dt>
                <dd className="text-sm font-medium first-letter:uppercase">{value}</dd>
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
              <span className="text-2xl font-bold tracking-[-0.02em] md:text-[1.75rem]">Entradas</span>
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
