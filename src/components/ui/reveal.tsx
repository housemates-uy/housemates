'use client';

import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '@/lib/reduced-motion';

// Aparece al entrar en pantalla. Con "reducir movimiento" aparece igual, pero sin animación.
// Siempre se dibuja el mismo elemento (solo cambia la transición) para no romper la hidratación.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotionSafe();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
