import { getImageProps } from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { AmbientVideo } from '@/components/ui/ambient-video';
import { buttonVariants } from '@/components/ui/button';
import type { LandingMedia, LandingMediaSet } from '@/lib/landing';
import type { NextEvent } from '@/lib/next-event';
import { cn } from '@/lib/utils';

// Portada: dos recortes, uno para el celular y otro para la compu (se cambian en
// /admin/landing). La de siempre es el open air 12.12.25, la casita de neón con la pista
// adelante (foto @photolechu): ya es azul eléctrico, va sin filtro, solo con el degradado
// para leer el texto.
const MEDIA_CLASS = 'absolute inset-0 h-full w-full object-cover object-[50%_40%] md:object-[50%_0%]';
// GIF transparente de 1 px: el recorte que no va en ese ancho no se baja.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function imageProps(media: LandingMedia) {
  const common = { alt: '', priority: true, sizes: '100vw', src: media.src };
  return getImageProps(
    media.width && media.height ? { ...common, width: media.width, height: media.height } : { ...common, fill: true },
  ).props;
}

function HeroLayer({ media, className, hiddenMedia }: { media: LandingMedia; className: string; hiddenMedia: string }) {
  if (media.type === 'video') {
    return (
      <div className={className}>
        <AmbientVideo src={media.src} poster={media.poster ?? ''} label="" className={MEDIA_CLASS} />
      </div>
    );
  }
  return (
    <picture className={className}>
      <source media={hiddenMedia} srcSet={BLANK} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...imageProps(media)} alt="" className={MEDIA_CLASS} />
    </picture>
  );
}

function HeroBackground({ media }: { media: LandingMediaSet }) {
  const desktop = media['hero-desktop'];
  const mobile = media['hero-mobile'];
  if (desktop.type === 'image' && mobile.type === 'image') {
    const { srcSet: desktopSet } = imageProps(desktop);
    const { srcSet: mobileSet, ...img } = imageProps(mobile);
    return (
      <picture>
        <source media="(min-width: 768px)" srcSet={desktopSet} />
        <source srcSet={mobileSet} />
        {/* <picture> con dos recortes: next/image no lo resuelve solo (getImageProps arma los srcSet) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...img} alt="" className={MEDIA_CLASS} />
      </picture>
    );
  }
  // Con un video, cada recorte va por su lado. El video oculto no se baja (AmbientVideo
  // espera a que entre en pantalla).
  return (
    <>
      <HeroLayer media={mobile} className="md:hidden" hiddenMedia="(min-width: 768px)" />
      <HeroLayer media={desktop} className="max-md:hidden" hiddenMedia="(max-width: 767px)" />
    </>
  );
}

export function Hero({ event, title, media }: { event: NextEvent; title: string; media: LandingMediaSet }) {
  return (
    <section className="relative isolate flex min-h-[100dvh] flex-col justify-end overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ink">
        <HeroBackground media={media} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/65 to-ink/10 sm:via-ink/45" />
        <div className="grain absolute inset-0" />
      </div>

      <div className="mx-auto w-full max-w-page px-5 pb-12 pt-28 md:px-10 md:pb-16">
        <p className="animate-fade-up text-sm font-medium text-bone/75 [animation-delay:80ms]">
          {event.id ? (
            <>
              <span className="capitalize">{event.weekday}</span> {event.dateShort} · {event.time}
              {event.format ? ` hs · ${event.format}` : ' hs'}
            </>
          ) : (
            'Próxima fecha a confirmar'
          )}
        </p>
        <h1 className="mt-4 max-w-[13ch] animate-fade-up text-[clamp(2.75rem,9vw,6.5rem)] md:text-[clamp(3.5rem,6vw,5.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.03em] [animation-delay:160ms]">
          {title}
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
          {/* Link y no <a>: con un <a href="#…"> el botón "Atrás" queda trabado (Next 14). */}
          <Link href="#la-casa" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            Conocé la casa
            <ArrowDown size={16} strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
