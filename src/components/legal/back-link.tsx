'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

// Vuelve a la página anterior solo si era de este sitio (p. ej. el formulario de compra, que
// así conserva lo que la persona ya había escrito). Si se llegó desde afuera o en una pestaña
// nueva, va al inicio. La Navigation API solo expone entradas del mismo origen; donde no
// existe, se mira el referrer.
function previousPageIsOurs() {
  const nav = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  if (typeof nav?.canGoBack === 'boolean') return nav.canGoBack;
  return window.history.length > 1 && document.referrer.startsWith(`${window.location.origin}/`);
}

export function BackLink() {
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (!previousPageIsOurs()) return;
        e.preventDefault();
        window.history.back();
      }}
      className={buttonVariants({ variant: 'ghost', size: 'md', className: '-mr-3 gap-1.5 text-bone/70' })}
    >
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
      Volver
    </Link>
  );
}
