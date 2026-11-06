'use client';

import { useState } from 'react';
import { Check, Copy, Link2, MessageCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Copiar el código, copiar el link /acceso/<código> o mandarlo armado por WhatsApp.
// `compact`: la versión chica de cada fila de la lista.
export function ShareButtons({
  code,
  link,
  whatsapp,
  compact,
}: {
  code: string;
  link: string;
  whatsapp: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  function copy(what: 'code' | 'link', text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const variant = compact ? 'ghost' : 'outline';
  return (
    // En la fila, los íconos de los botones sin borde quedan alineados con el texto de arriba.
    <div className={cn('flex flex-wrap', compact ? '-mx-3.5 gap-1' : 'gap-2')}>
      <Button type="button" size="sm" variant={variant} onClick={() => copy('code', code)}>
        {copied === 'code' ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {copied === 'code' ? 'Copiado' : 'Copiar código'}
      </Button>
      <Button type="button" size="sm" variant={variant} onClick={() => copy('link', link)}>
        {copied === 'link' ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
        {copied === 'link' ? 'Copiado' : 'Copiar link'}
      </Button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ size: 'sm', variant: compact ? 'ghost' : 'solid' })}
      >
        <MessageCircle size={15} aria-hidden />
        {compact ? 'WhatsApp' : 'Mandar por WhatsApp'}
      </a>
    </div>
  );
}
