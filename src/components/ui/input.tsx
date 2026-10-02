import * as React from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-11 w-full rounded-control border border-bone/15 bg-bone/5 px-3.5 text-sm text-bone placeholder:text-bone/35 transition-colors focus:border-bone/60 focus:outline-none disabled:opacity-50 aria-[invalid=true]:border-alert';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-24 py-3', className)} {...props} />
));
Textarea.displayName = 'Textarea';
