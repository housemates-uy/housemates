import Image from 'next/image';
import { AmbientVideo } from '@/components/ui/ambient-video';
import { Reveal } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';

// Fotos de las últimas fechas (12.12.25 open air, 20.03.26 y 04.09.26).
// Fotos: @photolechu · Video: @xbengala. Los originales están en el Drive de cada fecha.
type Tile = { src: string; alt: string; className: string; sizes: string };

const TILES: Tile[] = [
  {
    src: '/photos/casa-de-noche.webp',
    alt: 'La carpa iluminada de noche, entre árboles con luces azules y rojas',
    className: 'col-span-6 aspect-[16/9]',
    sizes: '(min-width: 1024px) 58vw, 100vw',
  },
  {
    src: '/photos/abrazo.webp',
    alt: 'Un grupo de amigos abrazados y riéndose en la pista',
    className: 'col-span-3 aspect-[4/3]',
    sizes: '(min-width: 1024px) 29vw, 50vw',
  },
  {
    src: '/photos/cartel-madera.webp',
    alt: 'El logo de la casita en neón blanco sobre una puerta de madera',
    className: 'col-span-3 aspect-[4/3]',
    sizes: '(min-width: 1024px) 29vw, 50vw',
  },
  {
    src: '/photos/escenario-de-dia.webp',
    alt: 'La cabina con forma de casita en el open air, de día, con la gente bailando adelante',
    className: 'col-span-6 aspect-[16/9]',
    sizes: '(min-width: 1024px) 58vw, 100vw',
  },
  {
    src: '/photos/baile-vinedo.webp',
    alt: 'Una chica bailando con los brazos arriba en el viñedo',
    className: 'col-span-2 aspect-[2/3]',
    sizes: '(min-width: 1024px) 19vw, 33vw',
  },
  {
    src: '/photos/atardecer.webp',
    alt: 'Cuatro amigos en un sillón al atardecer, con el viñedo atrás',
    className: 'col-span-4 h-full',
    sizes: '(min-width: 1024px) 38vw, 66vw',
  },
  {
    src: '/photos/laseres.webp',
    alt: 'La pista llena bajo láseres azules',
    className: 'col-span-3 aspect-[4/3]',
    sizes: '(min-width: 1024px) 29vw, 50vw',
  },
  {
    src: '/photos/carpa-violeta.webp',
    alt: 'La carpa llena de gente con luces violetas',
    className: 'col-span-3 aspect-[4/3]',
    sizes: '(min-width: 1024px) 29vw, 50vw',
  },
];

function Photo({ tile, delay }: { tile: Tile; delay: number }) {
  return (
    <Reveal delay={delay} className={cn('relative overflow-hidden rounded-card', tile.className)}>
      <Image src={tile.src} alt={tile.alt} fill sizes={tile.sizes} className="object-cover" />
    </Reveal>
  );
}

export function House() {
  const [casaDeNoche, abrazo, cartel, ...resto] = TILES;

  return (
    <section id="la-casa" className="border-t border-bone/10">
      <div className="mx-auto max-w-page px-5 py-20 md:px-10 md:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            <h2 className="text-4xl font-bold leading-[1.02] tracking-[-0.02em] md:text-6xl">
              Una casa, de noche.
            </h2>
            <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-bone/65">
              House Mates nació como una junta de amigos en una casa y creció sin perder eso: la
              calidez de estar en casa y la energía de una noche de club.
            </p>
          </Reveal>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-6 gap-3 md:gap-4">
              <Photo tile={casaDeNoche} delay={0} />

              {/* Video vertical al lado de dos fotos apiladas */}
              <Reveal delay={0.06} className="relative col-span-3 row-span-2 overflow-hidden rounded-card">
                <AmbientVideo
                  src="/video/casita-neon.mp4"
                  poster="/video/casita-neon.webp"
                  label="La casita de neón violeta con la pista llena, en el open air"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </Reveal>
              <Photo tile={abrazo} delay={0.1} />
              <Photo tile={cartel} delay={0.14} />

              {resto.map((tile, i) => (
                <Photo key={tile.src} tile={tile} delay={0.06 * (i % 2)} />
              ))}
            </div>
            <p className="mt-4 text-xs text-bone/55">Fotos: @photolechu · Video: @xbengala</p>
          </div>
        </div>
      </div>
    </section>
  );
}
