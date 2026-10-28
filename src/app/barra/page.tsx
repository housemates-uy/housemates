import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Logo } from '@/components/ui/logo';
import { isLocalNoAuth } from '@/lib/auth/local-mode';
import { getBarMenu } from '@/lib/bar';
import { getCustomer } from '@/lib/customers';
import { getNextEvent } from '@/lib/next-event';
import { getIgHandle, igUrl } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { BarOrderForm } from './order-form';

export const metadata: Metadata = { title: 'Barra' };
export const dynamic = 'force-dynamic';

// Carta de la barra del próximo evento. Se usa también durante la fiesta, con poca luz:
// letra grande, botones grandes y el total siempre visible abajo.
// No pide la contraseña del gate (esa es solo para comprar entradas) ni cuenta.
export default async function BarraPage() {
  const [event, igHandle, customer] = await Promise.all([
    getNextEvent(),
    getIgHandle(),
    getCustomer().catch(() => null),
  ]);

  const [menu, paused] = event.id
    ? await Promise.all([
        getBarMenu(event.id),
        createAdminClient()
          .from('events')
          .select('bar_paused')
          .eq('id', event.id)
          .single()
          .then(({ data }) => data?.bar_paused ?? true),
      ])
    : [[], true];
  const open = !!event.id && !paused && menu.length > 0;

  return (
    <div className="relative isolate min-h-[100dvh]">
      <DoodleBackdrop className="fixed -z-10" />
      <main id="contenido" className="mx-auto min-h-[100dvh] max-w-xl px-5">
        <header className="flex h-20 items-center justify-between">
          <Link href="/" aria-label="House Mates, inicio" className="p-2">
            <Logo className="h-11" />
          </Link>
          <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Volver
          </Link>
        </header>

        <section className="pt-8">
          <Eyebrow>{event.id ? `Barra · ${event.dateShort}` : 'Barra'}</Eyebrow>
          <h1 className="mt-4 text-[clamp(3.25rem,15vw,5.5rem)] font-bold leading-[0.88] tracking-[-0.04em]">
            Pedí tus tragos
          </h1>
          <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-bone/70">
            Comprás antes o durante la fiesta, pagás con Mercado Pago y te llega un QR por cada trago.
            En la fiesta lo mostrás en la barra y retirás tu trago cuando quieras.
          </p>
        </section>

        {open ? (
          <BarOrderForm
            products={menu}
            account={customer ? { email: customer.email, name: customer.profile?.name ?? null } : null}
            allowSimulate={isLocalNoAuth()}
          />
        ) : (
          <Card className="mb-16 mt-12 p-6 md:p-8">
            <h2 className="text-xl font-bold tracking-tight">
              {paused && menu.length > 0 ? 'La barra está pausada' : 'La barra todavía no abrió'}
            </h2>
            <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-bone/65">
              {paused && menu.length > 0
                ? 'En un rato vuelve. Si ya compraste, tus QRs siguen valiendo: mostralos en la barra.'
                : 'Cuando esté la carta de la próxima fecha la vas a ver acá. Avisamos por Instagram.'}
            </p>
            <a
              href={igUrl(igHandle)}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: 'lg', className: 'mt-7' })}
            >
              Instagram {igHandle}
            </a>
          </Card>
        )}
      </main>
    </div>
  );
}
