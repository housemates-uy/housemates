import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { buttonVariants } from '@/components/ui/button';

export function SiteNav({ igHandle, igHref }: { igHandle: string; igHref: string }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-20 max-w-page items-center justify-between px-5 md:px-10"
      >
        <Link href="/" aria-label="House Mates, inicio" className="p-2 text-bone">
          <Logo className="h-11" />
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={igHref}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
          >
            {igHandle}
          </a>
          <Link href="/entradas" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Entradas
          </Link>
        </div>
      </nav>
    </header>
  );
}
