import Link from 'next/link';
import { User } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SiteNav({
  igHandle,
  igHref,
  accountsEnabled,
}: {
  igHandle: string;
  igHref: string;
  accountsEnabled: boolean; // "Mi cuenta" prendida en /admin/config
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-20 max-w-page items-center justify-between px-4 sm:px-5 md:px-10"
      >
        <Link href="/" aria-label="House Mates, inicio" className="p-2 text-bone">
          <Logo className="h-11" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/barra" className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'px-3 sm:px-5')}>
            Barra
          </Link>
          <a
            href={igHref}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'ghost', size: 'md', className: 'hidden sm:inline-flex' })}
          >
            {igHandle}
          </a>
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
          <Link
            href="/entradas"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'md' }),
              'border-bone/45 bg-ink/30 px-4 font-semibold backdrop-blur-sm hover:border-bone hover:bg-ink/50 sm:px-5',
            )}
          >
            Entradas
          </Link>
        </div>
      </nav>
    </header>
  );
}
