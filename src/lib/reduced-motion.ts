'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// useReducedMotion de framer devuelve null en el servidor y true/false en el navegador.
// Si lo que se dibuja depende de ese valor, el HTML del servidor no coincide con el del
// navegador y React tira un error de hidratación (pasaba con "reducir movimiento" activado
// en el celular). Este hook devuelve false hasta que la página termina de cargar y recién
// ahí el valor real, así los dos dibujan lo mismo al principio.
export function useReducedMotionSafe(): boolean {
  const reduce = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated && !!reduce;
}
