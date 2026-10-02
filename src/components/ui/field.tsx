import * as React from 'react';
import { cn } from '@/lib/utils';

// Label arriba, ayuda y error abajo. Asocia label/input por id e inyecta aria-invalid.
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactElement;
}) {
  const generatedId = React.useId();
  const id = children.props.id ?? generatedId;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-bone/70">
        {label}
      </label>
      {React.cloneElement(children, { id, 'aria-invalid': error ? true : undefined })}
      {hint && !error && <p className="text-xs text-bone/45">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
