import Image from 'next/image';
import { AmbientVideo } from '@/components/ui/ambient-video';
import { Reveal } from '@/components/ui/reveal';
import { HOUSE_TILES, type LandingMedia, type LandingPageContent } from '@/lib/landing';
import { cn } from '@/lib/utils';

// Los textos, las fotos y los videos se cambian en /admin/landing. Los de siempre y la
// disposición de la grilla están en src/lib/landing.ts.
function Tile({ tile, media }: { tile: (typeof HOUSE_TILES)[number]; media: LandingMedia }) {
  return (
    <Reveal delay={tile.delay} className={cn('relative overflow-hidden rounded-card', tile.className)}>
      {media.type === 'video' ? (
        <AmbientVideo
          src={media.src}
          poster={media.poster ?? ''}
          label={media.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image src={media.src} alt={media.alt} fill sizes={tile.sizes} className="object-cover" />
      )}
    </Reveal>
  );
}

export function House({ content }: { content: LandingPageContent }) {
  return (
    <section id="la-casa" className="border-t border-bone/10">
      <div className="mx-auto max-w-page px-5 py-20 md:px-10 md:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            <h2 className="text-4xl font-bold leading-[1.02] tracking-[-0.02em] md:text-6xl">
              {content.houseTitle}
            </h2>
            <p className="mt-6 max-w-[46ch] whitespace-pre-line text-base leading-relaxed text-bone/65">
              {content.houseText}
            </p>
          </Reveal>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-6 gap-3 md:gap-4">
              {HOUSE_TILES.map((tile) => (
                <Tile key={tile.slot} tile={tile} media={content.media[tile.slot]} />
              ))}
            </div>
            {content.houseCredits && <p className="mt-4 text-xs text-bone/55">{content.houseCredits}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
