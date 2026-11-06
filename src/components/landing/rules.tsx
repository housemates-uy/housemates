import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Reveal } from '@/components/ui/reveal';
import type { LandingContent } from '@/lib/landing';
import { cn } from '@/lib/utils';

// Sin la contraseña o un código, las reglas no salen del servidor: solo el título y el botón
// para entrar (vuelve acá, a #reglas).
export function Rules({ content, locked }: { content: LandingContent; locked: boolean }) {
  return (
    <section id="reglas" className="relative isolate overflow-hidden border-t border-bone/10">
      <DoodleBackdrop className="-z-10" />
      <div className="mx-auto max-w-page px-5 py-20 md:px-10 md:py-28">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-[-0.02em] md:text-5xl">{content.rulesTitle}</h2>
          <span aria-hidden className="mt-6 block h-px w-16 bg-violet" />
          {locked ? (
            <div className="mt-8">
              <p className="flex max-w-[40ch] items-start gap-2.5 text-lg font-medium leading-snug text-bone/75 md:text-xl">
                <Lock size={18} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-violet" />
                Las reglas de la casa se ven al entrar con la contraseña o tu código.
              </p>
              <Link
                href="/access?next=%2F%23reglas"
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'group mt-8 font-semibold')}
              >
                Entrar
                <ArrowRight
                  size={17}
                  strokeWidth={1.75}
                  aria-hidden
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          ) : (
            <ol className="mt-8 space-y-5">
              {content.rules.map((rule, i) => (
                <li key={i} className="grid grid-cols-[2.5rem_1fr] items-baseline text-lg md:text-xl">
                  <span className="text-sm font-bold text-bone/50">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-medium leading-snug">{rule}</span>
                </li>
              ))}
            </ol>
          )}
        </Reveal>
      </div>
    </section>
  );
}
