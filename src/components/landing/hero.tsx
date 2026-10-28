import { getImageProps } from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { NextEvent } from '@/lib/next-event';
import { cn } from '@/lib/utils';

// Portada: open air 12.12.25, la casita de neón con la pista adelante (foto @photolechu).
// Dos recortes: vertical para el celular y horizontal para la compu. Con una sola foto
// horizontal, el celular mostraba un pedazo chico agrandado y se veía pixelado.
// La foto ya es azul eléctrico: va sin filtro, solo con el degradado para leer el texto.
function heroSources() {
  const common = { alt: '', priority: true, sizes: '100vw' };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: '/photos/portada.webp', width: 2800, height: 1540 });
  const {
    props: { srcSet: mobile, ...img },
  } = getImageProps({ ...common, src: '/photos/portada-vertical.webp', width: 1080, height: 2160 });
  return { desktop, mobile, img };
}

export function Hero({ event }: { event: NextEvent }) {
  const { desktop, mobile, img } = heroSources();

  return (
    <section className="relative isolate flex min-h-[100dvh] flex-col justify-end overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ink">
        <picture>
          <source media="(min-width: 768px)" srcSet={desktop} />
          <source srcSet={mobile} />
          {/* <picture> con dos recortes: next/image no lo resuelve solo (getImageProps arma los srcSet) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...img} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%] md:object-[50%_0%]" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/10" />
        <div className="grain absolute inset-0" />
      </div>

      <div className="mx-auto w-full max-w-page px-5 pb-12 pt-28 md:px-10 md:pb-16">
        <p className="animate-fade-up text-sm font-medium text-bone/75 [animation-delay:80ms]">
          <span className="capitalize">{event.weekday}</span> {event.dateShort} · {event.time} hs · Open air
        </p>
        <h1 className="mt-4 max-w-[13ch] animate-fade-up text-[clamp(2.75rem,9vw,6.5rem)] md:text-[clamp(3.5rem,6vw,5.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.03em] [animation-delay:160ms]">
          Tu casa favorita vuelve a MVD
        </h1>
        <div className="mt-9 flex animate-fade-up flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 [animation-delay:260ms]">
          <Link
            href="/entradas"
            className={cn(buttonVariants({ size: 'lg' }), 'group h-14 px-9 text-base font-semibold')}
          >
            Entradas
            <ArrowRight
              size={18}
              strokeWidth={1.75}
              aria-hidden
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
          <a href="#la-casa" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            Conocé la casa
            <ArrowDown size={16} strokeWidth={1.5} aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
