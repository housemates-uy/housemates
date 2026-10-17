import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Logo } from '@/components/ui/logo';
import { TandaStatus } from '@/components/ui/tanda-status';
import { hasGateAccess } from '@/lib/auth/gate';
import { getNextEvent } from '@/lib/next-event';
import { getIgHandle, igUrl } from '@/lib/site';

export const metadata: Metadata = { title: 'Entradas' };
export const dynamic = 'force-dynamic';

export default async function EntradasPage() {
  if (!(await hasGateAccess())) redirect('/access?next=/entradas');

  const [event, igHandle] = await Promise.all([getNextEvent(), getIgHandle()]);

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

      {event.tandas.length > 0 && (
        <ul className="mt-12 divide-y divide-bone/10 border-y border-bone/10">
          {event.tandas.map((t) => (
            <li key={t.id} className="py-6">
              <TandaStatus name={t.name} state={t.state} />
            </li>
          ))}
        </ul>
      )}

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
    </main>
  );
}
