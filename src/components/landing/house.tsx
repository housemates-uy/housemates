import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Reveal } from '@/components/ui/reveal';

export function House() {
  return (
    <section id="la-casa" className="border-t border-bone/10">
      <div className="mx-auto max-w-page px-5 py-20 md:px-10 md:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <h2 className="text-4xl font-bold leading-[1.02] tracking-[-0.02em] md:text-6xl">
              Una casa, de noche.
            </h2>
            <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-bone/65">
              House Mates nació como una junta de amigos en una casa y creció sin perder eso: la
              calidez de estar en casa y la energía de una noche de club.
            </p>

            <div className="mt-10 space-y-7">
              <div>
                <Badge tone="casa">Casa</Badge>
                <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-bone/60">
                  Plantas, luz cálida, gente abrazándose. Venís a encontrarte con los tuyos.
                </p>
              </div>
              <div>
                <Badge tone="club">Club</Badge>
                <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-bone/60">
                  Sonido en serio, cabina a la altura de la pista y una noche que termina tarde.
                </p>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-6 gap-3 md:gap-4 lg:col-span-7">
            <Reveal className="col-span-6">
              <figure className="relative aspect-[16/9] overflow-hidden rounded-card">
                <Image
                  src="/photos/hm-04.webp"
                  alt="Tres amigos abrazados y sonriendo en la cabina de House Mates"
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover"
                />
              </figure>
            </Reveal>
            <Reveal delay={0.08} className="col-span-2">
              <figure className="relative aspect-[2/3] overflow-hidden rounded-card">
                <Image
                  src="/photos/hm-02.webp"
                  alt="Dos DJs mezclando entre plantas y luces de colores"
                  fill
                  sizes="(min-width: 1024px) 19vw, 33vw"
                  className="object-cover"
                />
              </figure>
            </Reveal>
            <Reveal delay={0.16} className="col-span-4">
              <figure className="relative h-full min-h-40 overflow-hidden rounded-card">
                <Image
                  src="/photos/hm-03.webp"
                  alt="Dos DJs saludando detrás de la cabina"
                  fill
                  sizes="(min-width: 1024px) 38vw, 66vw"
                  className="object-cover"
                />
              </figure>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
