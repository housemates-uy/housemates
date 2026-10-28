import Link from 'next/link';
import { formatUYU } from '@/lib/events';
import { cn } from '@/lib/utils';
import type { NextEvent } from '@/lib/next-event';

// Tarjeta de una tanda en la landing: nombre, precio de la entrada y estado.
// Si se puede comprar, lleva directo al formulario con esa tanda elegida.
// Las agotadas también muestran el precio (cuánto salía).
export function TandaCard({ tanda }: { tanda: NextEvent['tandas'][number] }) {
  const content = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-label text-bone/55">{tanda.name}</p>
      <p className={cn('mt-2 text-3xl font-bold tracking-tight', !tanda.purchasable && 'text-bone/40 line-through decoration-2')}>
        {formatUYU(tanda.price)}
      </p>
      <p
        className={cn(
          'mt-3 text-sm font-bold uppercase tracking-[0.12em]',
          tanda.purchasable ? 'text-bone' : 'text-alert',
        )}
      >
        {tanda.purchasable ? 'Disponible' : 'Sold out'}
      </p>
    </>
  );

  if (!tanda.purchasable) {
    return <div className="rounded-card border border-bone/10 p-5">{content}</div>;
  }
  return (
    <Link
      href={`/entradas?tanda=${tanda.id}`}
      className="block rounded-card border border-bone/25 p-5 transition-colors hover:border-bone hover:bg-bone/5"
    >
      {content}
    </Link>
  );
}
