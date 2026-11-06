import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Logo } from '@/components/ui/logo';
import { igUrl } from '@/lib/site';
import { cn } from '@/lib/utils';
import { BackLink } from './back-link';

// Páginas de ayuda y legales (/preguntas-frecuentes, /terminos, /privacidad): fondo doodle
// desenfocado fijo detrás del texto largo, como pide el manual para comunicación informativa.

export type LegalPath = '/preguntas-frecuentes' | '/terminos' | '/privacidad';
export type TocItem = { id: string; label: string };

const PAGES: { href: LegalPath; label: string }[] = [
  { href: '/preguntas-frecuentes', label: 'Preguntas frecuentes' },
  { href: '/terminos', label: 'Términos' },
  { href: '/privacidad', label: 'Privacidad' },
];

export const proseClass = cn(
  'space-y-4 text-[15px] leading-[1.7] text-bone/75 md:text-base',
  '[&_strong]:font-semibold [&_strong]:text-bone',
  '[&_a]:font-medium [&_a]:text-bone [&_a]:underline [&_a]:decoration-bone/30 [&_a]:underline-offset-4 [&_a:hover]:decoration-bone',
  '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:pl-1 marker:text-bone/35',
);

export function LegalPage({
  current,
  eyebrow,
  title,
  intro,
  updated,
  toc,
  igHandle,
  children,
}: {
  current: LegalPath;
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  updated?: { iso: string; label: string };
  toc: TocItem[];
  igHandle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col">
      <DoodleBackdrop className="fixed -z-10" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-ink/30 via-ink/55 to-ink/70" />

      <header className="mx-auto flex h-20 w-full max-w-page items-center justify-between px-5 md:px-10">
        <Link href="/" aria-label="House Mates, inicio" className="-ml-2 p-2 text-bone">
          <Logo className="h-10 md:h-11" />
        </Link>
        <BackLink />
      </header>

      <main id="contenido" className="mx-auto w-full max-w-page flex-1 px-5 pb-20 pt-8 md:px-10 md:pb-28 md:pt-14">
        <div className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.6rem,10.5vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.04em]">
            {title}
          </h1>
          <span aria-hidden className="mt-7 block h-px w-16 bg-violet" />
          {intro && <p className="mt-7 max-w-[54ch] text-base leading-relaxed text-bone/75 md:text-lg">{intro}</p>}
          {updated && (
            <p className="mt-4 text-xs text-bone/50">
              Última actualización: <time dateTime={updated.iso}>{updated.label}</time>
            </p>
          )}
        </div>

        <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
          <Toc items={toc} />
          <div className="min-w-0 max-w-[68ch]">{children}</div>
        </div>
      </main>

      <footer className="border-t border-bone/10 bg-ink/40">
        <div className="mx-auto flex max-w-page flex-col gap-5 px-5 py-10 text-sm text-bone/55 md:flex-row md:items-center md:justify-between md:px-10">
          <nav aria-label="Ayuda y legales">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {PAGES.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    aria-current={p.href === current ? 'page' : undefined}
                    className={cn('transition-colors hover:text-bone', p.href === current && 'text-bone')}
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p>
            <a href={igUrl(igHandle)} target="_blank" rel="noreferrer" className="transition-colors hover:text-bone">
              Instagram {igHandle}
            </a>{' '}
            · Montevideo, Uruguay
          </p>
        </div>
      </footer>
    </div>
  );
}

// En el celular: con pocas secciones, chips a la vista; con muchas, un índice plegable.
// En la compu: columna fija a la izquierda.
function Toc({ items }: { items: TocItem[] }) {
  const links = (className: string) =>
    items.map((item) => (
      <li key={item.id}>
        {/* Link y no <a>: con un <a href="#…"> el botón "Atrás" queda trabado (Next 14). */}
        <Link href={`#${item.id}`} className={className}>
          {item.label}
        </Link>
      </li>
    ));

  return (
    <>
      {items.length <= 6 ? (
        <nav aria-label="En esta página" className="lg:hidden">
          <ul className="flex flex-wrap gap-2">
            {links(
              'inline-flex h-9 items-center rounded-chip border border-bone/20 bg-ink/40 px-3 text-[13px] font-medium text-bone/80 transition-colors hover:border-bone/50 hover:text-bone',
            )}
          </ul>
        </nav>
      ) : (
        <details className="group rounded-card border border-bone/15 bg-ink/50 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-card px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            En esta página
            <ChevronDown
              size={18}
              strokeWidth={1.75}
              aria-hidden
              className="text-bone/50 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <nav aria-label="En esta página" className="border-t border-bone/10 px-4 py-3">
            <ol className="space-y-1">{links('block py-1.5 text-sm text-bone/70 transition-colors hover:text-bone')}</ol>
          </nav>
        </details>
      )}

      <nav aria-label="En esta página" className="hidden lg:block">
        <div className="sticky top-8">
          <p className="text-[11px] font-bold uppercase tracking-label text-bone/55">En esta página</p>
          <ul className="mt-4 space-y-1 border-l border-bone/10">
            {links('-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-bone/60 transition-colors hover:border-bone/50 hover:text-bone')}
          </ul>
        </div>
      </nav>
    </>
  );
}

export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-6 border-t border-bone/10 py-10 first:border-t-0 first:pt-0 last:pb-0"
    >
      <h2
        id={`${id}-titulo`}
        className="grid grid-cols-[2.25rem_1fr] items-baseline text-xl font-bold tracking-[-0.015em] md:text-2xl"
      >
        <span className="text-sm text-bone/50">{String(number).padStart(2, '0')}</span>
        <span>{title}</span>
      </h2>
      <div className={cn(proseClass, 'mt-5 md:pl-9')}>{children}</div>
    </section>
  );
}
