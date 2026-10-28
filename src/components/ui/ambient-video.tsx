'use client';

import { useReducedMotionSafe } from '@/lib/reduced-motion';

// Video de ambiente: sin sonido, en loop y sin controles. Si la persona pidió menos
// movimiento en su sistema, se muestra solo la imagen fija.
export function AmbientVideo({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotionSafe();

  if (reduce) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={label} className={className} />;
  }

  return (
    <video
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={label}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
