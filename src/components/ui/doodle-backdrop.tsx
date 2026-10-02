import Image from 'next/image';
import { cn } from '@/lib/utils';

// Fondo de comunicación informativa: set doodle desenfocado y en grises, para que
// el texto largo tenga contraste parejo (manual, sección 06).
export function DoodleBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <Image
        src="/brand/doodles.webp"
        alt=""
        fill
        sizes="100vw"
        className="scale-110 object-cover opacity-70 blur-[6px] grayscale"
      />
      <div className="absolute inset-0 bg-ink/45" />
    </div>
  );
}
