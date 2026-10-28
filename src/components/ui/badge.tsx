import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-chip px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.16em]',
  {
    variants: {
      tone: {
        neutral: 'bg-bone/10 text-bone/60',
        solid: 'bg-bone text-ink',
        club: 'bg-violet/15 text-violet',
        casa: 'bg-amber/15 text-amber',
        alert: 'bg-alert/15 text-alert',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  tone,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
