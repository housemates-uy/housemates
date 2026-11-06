import { cn } from '@/lib/utils';

// Vocabulario cerrado del manual: SOLD OUT / DISPONIBLE / X% VENDIDA, más PRÓXIMAMENTE para
// una tanda que todavía no salió a la venta (aprobado por los dueños). No inventar variantes.
// opens: cuándo sale ("vie 20.11 · 20:00 hs"), si tiene fecha.
export type TandaState =
  | { kind: 'sold_out' }
  | { kind: 'available' }
  | { kind: 'selling'; percent: number }
  | { kind: 'upcoming'; opens: string | null };

export function tandaStateLabel(state: TandaState): string {
  if (state.kind === 'sold_out') return 'Sold out';
  if (state.kind === 'selling') return `${state.percent}% vendida`;
  if (state.kind === 'upcoming') return 'Próximamente';
  return 'Disponible';
}

export function tandaState(tier: {
  quantity_sold: number;
  quantity_total: number;
  sold_out_override: boolean;
}): TandaState {
  if (tier.sold_out_override || tier.quantity_sold >= tier.quantity_total) return { kind: 'sold_out' };
  if (tier.quantity_sold <= 0) return { kind: 'available' };
  return { kind: 'selling', percent: Math.floor((tier.quantity_sold / tier.quantity_total) * 100) };
}

export function TandaStatus({
  name,
  state,
  className,
}: {
  name: string;
  state: TandaState;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p className="text-[11px] font-bold uppercase tracking-label text-bone/55">{name}</p>
      <p
        className={cn(
          'text-2xl font-bold uppercase leading-none tracking-tight',
          state.kind === 'sold_out' ? 'text-alert' : state.kind === 'upcoming' ? 'text-bone/60' : 'text-bone',
        )}
      >
        {tandaStateLabel(state)}
      </p>
      {state.kind === 'upcoming' && state.opens && <p className="text-xs text-bone/55">Sale el {state.opens}</p>}
      {state.kind === 'selling' && (
        <div
          role="progressbar"
          aria-valuenow={state.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name}: ${state.percent}% vendida`}
          className="relative mt-1 h-px w-full bg-bone/20"
        >
          <span className="absolute inset-y-0 left-0 bg-violet" style={{ width: `${state.percent}%` }} />
          <span
            className="absolute -top-1 h-[9px] w-px bg-violet"
            style={{ left: `${state.percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
