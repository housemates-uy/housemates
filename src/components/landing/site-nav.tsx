import Link from 'next/link';
import { ArrowRight, User } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Arriba a la derecha va solo Entradas (la Barra y el Instagram quedan en el pie y en las
// preguntas frecuentes). El brillo azul es el del neón de la casita de la portada.
export function SiteNav({ accountsEnabled }: { accountsEnabled: boolean /* "Mi cuenta" prendida en /admin/config */ }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-20 max-w-page items-center justify-between px-4 sm:px-5 md:h-24 md:px-10"
      >
        <Link href="/" aria-label="House Mates, inicio" className="p-2 text-bone">
          <Logo className="h-11" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          {accountsEnabled && (
            <Link
              href="/cuenta"
              aria-label="Mi cuenta"
              className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'px-2.5 sm:px-5')}
            >
              <User size={18} strokeWidth={1.5} aria-hidden className="sm:hidden" />
              <span className="hidden sm:inline">Mi cuenta</span>
            </Link>
          )}
          <Link href="/entradas" className="group relative isolate inline-flex rounded-control">
            <span
              aria-hidden
              className="absolute -inset-1.5 -z-10 rounded-card bg-electric/70 blur-lg motion-safe:animate-pulse"
            />
            <span
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-12 gap-2.5 px-6 text-[17px] font-bold tracking-[-0.01em] shadow-[0_0_0_1px_rgba(36,71,245,0.9),0_0_24px_2px_rgba(36,71,245,0.55)] md:h-14 md:px-8 md:text-lg',
              )}
            >
              Entradas
              <ArrowRight
                size={19}
                strokeWidth={2}
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
