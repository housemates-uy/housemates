'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// El día del evento el panel se refresca solo (y al volver a la pestaña), así el contador
// de la puerta sube sin recargar.
export function LiveRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [seconds, router]);

  return null;
}
