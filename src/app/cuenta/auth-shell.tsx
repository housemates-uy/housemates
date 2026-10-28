import Link from 'next/link';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';

// Pantalla de las páginas de acceso a la cuenta (ingresar, recuperar, contraseña nueva),
// con el mismo fondo doodle desenfocado que /access.
export function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main id="contenido" className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden">
      <DoodleBackdrop className="-z-10" />

      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <Link href="/" aria-label="House Mates, inicio" className="p-2">
              <Logo className="h-20" />
            </Link>
            <h1 className="mt-8 text-2xl font-bold tracking-tight">{title}</h1>
            {intro && <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-bone/60">{intro}</p>}
          </div>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <footer className="flex items-center justify-between px-5 py-6 text-sm text-bone/55 md:px-10">
        <Link href="/" className="transition-colors hover:text-bone">
          Volver al inicio
        </Link>
        <Link href="/entradas" className="transition-colors hover:text-bone">
          Entradas
        </Link>
      </footer>
    </main>
  );
}
