import { cn } from '@/lib/utils';

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-[11px] font-bold uppercase tracking-label text-bone/45', className)}
      {...props}
    />
  );
}
