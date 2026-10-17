import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { NextEvent } from '@/lib/next-event';

export function Hero({ event }: { event: NextEvent }) {
  return (
    <section className="relative isolate flex min-h-[100dvh] flex-col justify-end overflow-hidden">
      {/* Duotono azul: foto en grises multiplicada sobre el azul eléctrico */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-electric">
        <Image
          src="/photos/hm-01.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[35%_30%] mix-blend-multiply contrast-125 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
        <div className="grain absolute inset-0" />
      </div>

      <div className="mx-auto w-full max-w-page px-5 pb-12 pt-28 md:px-10 md:pb-16">
        <p className="animate-fade-up text-sm font-medium text-bone/75 [animation-delay:80ms]">
          <span className="capitalize">{event.weekday}</span> {event.dateShort} · Open air · Montevideo
        </p>
        <h1 className="mt-4 max-w-[13ch] animate-fade-up text-[clamp(2.75rem,9vw,6.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.03em] [animation-delay:160ms]">
          Tu casa favorita vuelve a MVD
        </h1>
        <div className="mt-9 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:260ms]">
          <Link href="/entradas" className={buttonVariants({ size: 'lg' })}>
            Entradas
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
