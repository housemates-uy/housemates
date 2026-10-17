'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mientras la entrada está válida, la página se refresca sola cada 5 s (y al volver a la
// pestaña). Así, cuando el portero confirma el ingreso, el celular de la persona pasa a
// "Usada" sin que tenga que recargar.
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, router]);

  return null;
}
