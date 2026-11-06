import { formatUYU } from '@/lib/events';
import { cn } from '@/lib/utils';

export type DaySales = {
  key: string;
  label: string;
  longLabel: string;
  count: number;
  amount: number;
};

// Escala "redonda" para el eje: pasos de 1, 2 o 5 × 10^n.
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const f = raw / power;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * power;
  return Math.max(1, Math.round(step));
}

const entradas = (n: number) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`;

// Columnas por día, sin librerías: el tooltip es CSS (hover y foco con teclado) y la
// tabla de abajo tiene los mismos números, así nada depende del hover.
export function SalesByDay({ days, showAmount }: { days: DaySales[]; showAmount: boolean }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const peak = days.findIndex((d) => d.count === max);
  const n = days.length;
  const labelEvery = n <= 7 ? 1 : n <= 14 ? 3 : n <= 31 ? 7 : 14;
  const showLabel = (i: number) =>
    i === 0 || i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2);
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <div>
      <div className="flex gap-2 pt-7">
        <div
          aria-hidden
          className="relative h-40 w-7 shrink-0 text-right text-[11px] tabular-nums text-bone/40 md:h-48"
        >
          {ticks.map((v) => (
            <span
              key={v}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: pct(v) }}
            >
              {v}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-40 md:h-48">
            {ticks.map((v) => (
              <div
                key={v}
                aria-hidden
                className={cn('absolute inset-x-0 h-px', v === 0 ? 'bg-bone/25' : 'bg-bone/[0.07]')}
                style={{ bottom: pct(v) }}
              />
            ))}
            <ol className="absolute inset-0 flex items-end gap-[2px]">
              {days.map((d, i) => {
                const align =
                  n > 7 && i < n * 0.2
                    ? 'left-0'
                    : n > 7 && i > n * 0.8
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2';
                return (
                  <li key={d.key} className="flex h-full min-w-0 flex-1">
                    <div
                      role="img"
                      tabIndex={0}
                      aria-label={`${d.longLabel}: ${entradas(d.count)}${showAmount ? `, ${formatUYU(d.amount)}` : ''}`}
                      className="group flex h-full w-full items-end justify-center rounded-t-[4px] outline-none hover:bg-bone/[0.03] focus-visible:bg-bone/[0.05]"
                    >
                      <div
                        className="relative w-full max-w-[24px]"
                        style={{ height: pct(d.count) }}
                      >
                        {d.count > 0 && (
                          <div className="h-full rounded-t-[4px] bg-violet transition-colors group-hover:bg-bone group-focus-visible:bg-bone" />
                        )}
                        {i === peak && (
                          <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-medium tabular-nums text-bone group-hover:invisible group-focus-visible:invisible">
                            {d.count}
                          </span>
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            'pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-control bg-bone px-2.5 py-1.5 text-xs text-ink shadow-lg group-hover:block group-focus-visible:block',
                            align,
                          )}
                        >
                          <span className="font-bold">{entradas(d.count)}</span>
                          {showAmount && d.amount > 0 && (
                            <span className="font-bold"> · {formatUYU(d.amount)}</span>
                          )}
                          <span className="block text-ink/60">{d.longLabel}</span>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div aria-hidden className="mt-2 flex gap-[2px] text-[11px] text-bone/45">
            {days.map((d, i) => (
              <div key={d.key} className="relative h-4 min-w-0 flex-1">
                {showLabel(i) && (
                  <span
                    className={cn(
                      'absolute top-0 whitespace-nowrap',
                      n <= 7
                        ? 'left-1/2 -translate-x-1/2'
                        : i === 0
                          ? 'left-0'
                          : i === n - 1
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    {d.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-5 border-t border-bone/10 pt-4">
        <summary className="cursor-pointer text-xs text-bone/55 hover:text-bone">
          Ver como tabla
        </summary>
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-bone/45">
              <th className="py-1.5 font-normal">Día</th>
              <th className="py-1.5 text-right font-normal">Entradas</th>
              {showAmount && <th className="py-1.5 text-right font-normal">Cobrado</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-bone/10">
            {days
              .filter((d) => d.count > 0)
              .reverse()
              .map((d) => (
                <tr key={d.key}>
                  <td className="py-1.5 capitalize">{d.longLabel}</td>
                  <td className="py-1.5 text-right">{d.count}</td>
                  {showAmount && <td className="py-1.5 text-right">{formatUYU(d.amount)}</td>}
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
