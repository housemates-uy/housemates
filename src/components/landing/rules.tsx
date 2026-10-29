import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Reveal } from '@/components/ui/reveal';
import type { LandingContent } from '@/lib/landing';

export function Rules({ content }: { content: LandingContent }) {
  return (
    <section id="reglas" className="relative isolate overflow-hidden border-t border-bone/10">
      <DoodleBackdrop className="-z-10" />
      <div className="mx-auto max-w-page px-5 py-20 md:px-10 md:py-28">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-5xl">{content.rulesTitle}</h2>
          <span aria-hidden className="mt-6 block h-px w-16 bg-violet" />
          <ol className="mt-8 space-y-5">
            {content.rules.map((rule, i) => (
              <li key={i} className="grid grid-cols-[2.5rem_1fr] items-baseline text-lg md:text-xl">
                <span className="text-sm font-bold text-bone/50">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-medium leading-snug">{rule}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
