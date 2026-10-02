'use client';

import { useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

// Logo animado (se reproduce una vez). El video trae fondo negro puro: `screen`
// lo funde con el fondo de la página. Con reduced motion se muestra el logo fijo.
export function LogoIntro({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <Logo className="h-3/5" />
      </div>
    );
  }

  return (
    <video
      className={cn('object-contain mix-blend-screen', className)}
      src="/brand/logo-animated.mp4"
      poster="/brand/logo.svg"
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-label="House Mates"
    />
  );
}
