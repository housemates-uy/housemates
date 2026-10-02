import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        solid: 'bg-bone text-ink hover:bg-bone/85',
        outline: 'border border-bone/20 text-bone hover:border-bone/50 hover:bg-bone/5',
        ghost: 'text-bone/60 hover:bg-bone/5 hover:text-bone',
        danger: 'border border-alert/40 text-alert hover:border-alert hover:bg-alert/10',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px]',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-7 text-[15px]',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
