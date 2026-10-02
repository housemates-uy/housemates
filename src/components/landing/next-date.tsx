import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Reveal } from '@/components/ui/reveal';
import { TandaStatus } from '@/components/ui/tanda-status';
import type { NextEvent } from '@/lib/next-event';

export function NextDate({ event }: { event: NextEvent }) {
  const details = [
    ['Cuándo', `${event.weekday} ${event.dateLong}`],
    ['Formato', 'Open air'],
    ['Dónde', event.locationName ?? 'La ubicación exacta se comparte el día del evento'],
  ];

  return (
    <section id="fecha" className="border-t border-bone/10">
      <div className="mx-auto grid max-w-page gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[1.25fr_1fr] lg:gap-20">
        <Reveal>
          <Eyebrow>Próxima fecha</Eyebrow>
          <p className="mt-5 text-[clamp(4rem,17vw,12rem)] font-bold leading-[0.85] tracking-[-0.04em]">
            {event.dateShort}
          </p>
          <span aria-hidden className="mt-8 block h-px w-24 bg-electric shadow-[0_0_18px_2px_rgba(36,71,245,0.7)]" />
        </Reveal>

        <Reveal delay={0.1} className="flex flex-col justify-end">
          <dl className="divide-y divide-bone/10 border-y border-bone/10">
            {details.map(([term, value]) => (
              <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-4 py-4">
                <dt className="text-sm text-bone/45">{term}</dt>
                <dd className="text-sm font-medium first-letter:uppercase">{value}</dd>
              </div>
            ))}
          </dl>

          {event.tandas.length > 0 && (
            <ul className="mt-8 grid gap-7 sm:grid-cols-2">
              {event.tandas.map((t) => (
                <li key={t.id}>
                  <TandaStatus name={t.name} state={t.state} />
                </li>
              ))}
            </ul>
          )}

          <Link href="/entradas" className={buttonVariants({ size: 'lg', className: 'mt-10 self-start' })}>
            Entradas
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
