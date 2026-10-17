import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

export default function NotFound() {
  return (
    <main id="contenido" className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <Logo className="h-20" />
      <h1 className="mt-10 text-4xl font-bold tracking-[-0.02em] md:text-5xl">Esta no es la casa</h1>
      <p className="mt-3 text-sm text-bone/60">La página que buscás no existe o cambió de lugar.</p>
      <Link href="/" className={buttonVariants({ variant: 'outline', className: 'mt-9' })}>
        Volver al inicio
      </Link>
    </main>
  );
}
