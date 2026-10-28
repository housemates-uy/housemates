'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotionSafe } from '@/lib/reduced-motion';

// Video de ambiente: sin sonido, en loop y sin controles. Si la persona pidió menos
// movimiento en su sistema, se muestra solo la imagen fija.
// Se baja recién cuando está por entrar en pantalla (en el celular queda varias pantallas
// abajo) y se pausa cuando sale.
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
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          if (video.currentSrc) video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduce]);

  if (reduce) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={label} className={className} />;
  }

  return (
    <video
      ref={ref}
      className={className}
      src={near ? src : undefined}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
    />
  );
}
