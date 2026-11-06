import Image from 'next/image';
import Link from 'next/link';

const HELP_LINKS = [
  ['/preguntas-frecuentes', 'Preguntas frecuentes'],
  ['/terminos', 'Términos'],
  ['/privacidad', 'Privacidad'],
] as const;

// Ayuda y legales solo con el código de acceso: la portada pública no muestra nada de la venta.
export function SiteFooter({
  igHandle,
  igHref,
  unlocked,
}: {
  igHandle: string;
  igHref: string;
  unlocked: boolean;
}) {
  return (
    <footer className="border-t border-bone/10">
      <div className="mx-auto flex max-w-page flex-col gap-8 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-10">
        <Image
          src="/brand/lockup-horizontal.webp"
          alt="House Mates, est. 2023"
          width={1600}
          height={480}
          className="h-auto w-56 md:w-72"
        />
        <div className="flex flex-col gap-2 text-sm text-bone/50 md:items-end">
          <a
            href={igHref}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-bone transition-colors hover:text-bone/70"
          >
            Instagram {igHandle}
          </a>
          <p>Montevideo, Uruguay · © {new Date().getFullYear()}</p>
          {unlocked && (
            <nav aria-label="Ayuda y legales" className="mt-3">
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-bone/55">
                {HELP_LINKS.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="transition-colors hover:text-bone">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
