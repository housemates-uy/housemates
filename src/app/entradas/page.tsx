import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Logo } from '@/components/ui/logo';
import { TandaStatus } from '@/components/ui/tanda-status';
import { hasGateAccess } from '@/lib/auth/gate';
import { isMercadoPagoConfigured } from '@/lib/mercadopago';
import { formatUYU } from '@/lib/events';
import { getNextEvent } from '@/lib/next-event';
import { getIgHandle, igUrl } from '@/lib/site';
import { BuyForm } from './buy-form';

export const metadata: Metadata = { title: 'Entradas' };
export const dynamic = 'force-dynamic';

export default async function EntradasPage({ searchParams }: { searchParams: { tanda?: string } }) {
  if (!(await hasGateAccess())) {
    redirect(`/access?next=${encodeURIComponent(searchParams.tanda ? `/entradas?tanda=${searchParams.tanda}` : '/entradas')}`);
  }

  const [event, igHandle] = await Promise.all([getNextEvent(), getIgHandle()]);
  // Se vende online solo si: hay evento publicado con ventas activas, Mercado Pago está
  // configurado y queda al menos una tanda comprable. Si no, se explica cómo comprar por IG.
  const canBuy =
    !!event.id && event.salesActive && isMercadoPagoConfigured() && event.tandas.some((t) => t.purchasable);

  return (
    <main id="contenido" className="mx-auto min-h-[100dvh] max-w-3xl px-5 pb-20 md:px-10">
      <header className="flex h-20 items-center justify-between">
        <Link href="/" aria-label="House Mates, inicio" className="p-2">
          <Logo className="h-11" />
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Volver
        </Link>
      </header>

      <section className="pt-10">
        <Eyebrow>Entradas</Eyebrow>
        <h1 className="mt-4 text-[clamp(3.5rem,14vw,7rem)] font-bold leading-[0.88] tracking-[-0.04em]">
          {event.dateShort}
        </h1>
        <p className="mt-5 text-base text-bone/65">
          <span className="capitalize">{event.weekday}</span> {event.dateLong} · Open air · Montevideo
        </p>
      </section>

      {event.tandas.length > 0 && !canBuy && (
        <ul className="mt-12 divide-y divide-bone/10 border-y border-bone/10">
          {event.tandas.map((t) => (
            <li key={t.id} className="py-6">
              <div className="flex items-baseline justify-between gap-4">
                <TandaStatus name={t.name} state={t.state} />
                <span className="text-xl font-bold">{formatUYU(t.price)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canBuy ? (
        <Card className="mt-12 p-6 md:p-8">
          <h2 className="text-xl font-bold tracking-tight">Comprá tu entrada</h2>
          <p className="mt-2 text-sm text-bone/60">Una entrada por persona, a tu nombre.</p>
          <div className="mt-7">
            <BuyForm tandas={event.tandas} initialTanda={searchParams.tanda} />
          </div>
        </Card>
      ) : (
        <Card className="mt-12 p-6 md:p-8">
          <h2 className="text-xl font-bold tracking-tight">La venta por la web llega pronto</h2>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-bone/65">
            Por ahora las entradas se compran por transferencia. Escribinos por Instagram y te pasamos
            los datos. La entrada es personal: una por persona, a tu nombre y con tu CI.
          </p>
          <a
            href={igUrl(igHandle)}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: 'lg', className: 'mt-7' })}
          >
            Escribinos por Instagram
          </a>
        </Card>
      )}
    </main>
  );
}
