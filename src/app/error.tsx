'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="contenido" className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <Logo className="h-20" />
      <h1 className="mt-10 text-3xl font-bold tracking-[-0.02em]">Algo falló de nuestro lado</h1>
      <p className="mt-3 text-sm text-bone/60">Probá de nuevo en unos segundos.</p>
      <Button variant="outline" className="mt-9" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
