import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Logo } from '@/components/ui/logo';
import { TandaStatus } from '@/components/ui/tanda-status';
import { accessOrderLimit, formatAccessCode, heldInOrder } from '@/lib/access-codes';
import { getSessionAccessCode, hasGateAccess, hasPasswordAccess } from '@/lib/auth/gate';
import { getCustomer, isAccountsEnabled } from '@/lib/customers';
import { formatUYU } from '@/lib/events';
import { getNextEvent } from '@/lib/next-event';
import { getSaleConfig } from '@/lib/sale-config';
import { getIgHandle, igUrl } from '@/lib/site';
import { formatDocument, PURCHASE_COOKIE } from '@/lib/tickets';
import { getTransportOptions } from '@/lib/transport';
import { BuyForm } from './buy-form';

export const metadata: Metadata = { title: 'Entradas' };
export const dynamic = 'force-dynamic';

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: { tanda?: string; preventa?: string };
}) {
  // ?tanda= (desde la landing) y ?preventa= (link de preventa) sobreviven al paso por /access.
  const query = new URLSearchParams();
  if (searchParams.tanda) query.set('tanda', searchParams.tanda);
  if (searchParams.preventa) query.set('preventa', searchParams.preventa);
  const here = query.toString() ? `/entradas?${query}` : '/entradas';
  if (!(await hasGateAccess())) {
    redirect(`/access?next=${encodeURIComponent(here)}`);
  }

  const [event, igHandle, sale, customer, sessionCode, accountsOn] = await Promise.all([
    getNextEvent({ presaleCode: searchParams.preventa }),
    getIgHandle(),
    getSaleConfig(),
    getCustomer(),
    getSessionAccessCode(),
    isAccountsEnabled(),
  ]);
  // Código de acceso (§3b): si entró con uno de este evento, la compra no puede pasar de las
  // entradas que le quedan, más las que tiene reservadas su compra sin terminar (al reintentar
  // se liberan); con uno público, de una. Si todas están reservadas en compras de otras
  // personas y no entró con la contraseña, se le avisa en vez de mostrar el formulario.
  // Con la contraseña, un código público no limita (la contraseña ya deja comprar para amigos).
  const passwordAccess = await hasPasswordAccess();
  const sessionCodeForEvent = sessionCode && sessionCode.eventId === event.id ? sessionCode : null;
  const codeForEvent = sessionCodeForEvent?.kind === 'public' && passwordAccess ? null : sessionCodeForEvent;
  const codeLeft = codeForEvent
    ? codeForEvent.left + (await heldInOrder(codeForEvent.id, cookies().get(PURCHASE_COOKIE)?.value))
    : 0;
  const accessCode = codeForEvent && codeLeft > 0 ? { ...codeForEvent, left: codeLeft } : null;
  const codeBusy = !!codeForEvent && codeLeft === 0 && !passwordAccess;
  const maxPerOrder = accessCode
    ? Math.min(sale.maxPerOrder, accessOrderLimit(accessCode.kind, accessCode.left))
    : sale.maxPerOrder;
  // Link de preventa: su tanda aparece ya elegida. Si el código no existe, se avisa.
  const presaleTier = event.tandas.find((t) => t.presale);
  const presaleInvalid = !!searchParams.preventa && !presaleTier;
  // Se vende online solo si: hay evento publicado con ventas activas, hay al menos un medio
  // de pago activo (Mercado Pago o transferencia) y queda alguna tanda comprable.
  const canBuy =
    !!event.id &&
    event.salesActive &&
    (sale.mpEnabled || sale.transferEnabled) &&
    event.tandas.some((t) => t.purchasable);
  const soldOut =
    !canBuy && event.salesActive && event.tandas.length > 0 && event.tandas.every((t) => t.state.kind === 'sold_out');
  const transport = canBuy && event.id ? await getTransportOptions(event.id, { onlyActive: true }) : [];

  return (
    // Fondo doodle desenfocado: el manual lo pide para pantallas con texto largo (sección 06).
    // Fijo, así acompaña todo el formulario al hacer scroll.
    <div className="relative isolate min-h-[100dvh]">
      <DoodleBackdrop className="fixed -z-10" />
      <main id="contenido" className="mx-auto min-h-[100dvh] max-w-3xl px-5 pb-20 md:px-10">
        <header className="flex h-20 items-center justify-between">
          <Link href="/" aria-label="House Mates, inicio" className="p-2">
            <Logo className="h-11" />
          </Link>
          <div className="flex items-center gap-1">
            {accountsOn && (
              <Link
                href={customer ? '/cuenta' : `/cuenta/ingresar?next=${encodeURIComponent(here)}`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                {customer ? 'Mi cuenta' : 'Ingresar'}
              </Link>
            )}
            <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Volver
            </Link>
          </div>
        </header>

        <section className="pt-10">
          <Eyebrow>Entradas</Eyebrow>
          {event.id ? (
            <>
              <h1 className="mt-4 text-[clamp(3.5rem,14vw,7rem)] font-bold leading-[0.88] tracking-[-0.04em]">
                {event.dateShort}
              </h1>
              <p className="mt-5 text-base text-bone/65">
                <span className="capitalize">{event.weekday}</span> {event.dateLong} · {event.time} hs ·
                {' '}{event.format}
                {event.locationName && <> · {event.locationName}</>}
              </p>
            </>
          ) : (
            <h1 className="mt-4 text-[clamp(2.5rem,10vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.03em]">
              Próxima fecha a confirmar
            </h1>
          )}
        </section>

        {presaleInvalid && (
          <p role="status" className="mt-10 rounded-card border border-bone/15 bg-bone/[0.04] px-4 py-3 text-sm text-bone/75">
            Ese link de preventa no es válido o la preventa ya terminó.
          </p>
        )}

        {event.tandas.length > 0 && !canBuy && (
          <ul className="mt-12 divide-y divide-bone/10 border-y border-bone/10">
            {event.tandas.map((t) => (
              <li key={t.id} className="py-6">
                <div className="flex items-baseline justify-between gap-4">
                  <TandaStatus name={t.name} state={t.state} />
                  <span className="text-xl font-bold">{formatUYU(t.price)}</span>
                </div>
                {t.entryUntil && <p className="mt-2 text-xs text-bone/55">Ingreso hasta {t.entryUntil}</p>}
              </li>
            ))}
          </ul>
        )}

        {canBuy && codeBusy ? (
          <Card className="mt-12 p-4 sm:p-6 md:p-8">
            <h2 className="text-xl font-bold tracking-tight">Tu código está en uso</h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-bone/65">
              {codeForEvent.kind === 'public'
                ? `Las entradas del código ${formatAccessCode(codeForEvent.code)} están reservadas en compras que todavía no se pagaron. Si alguna no se paga, se libera en unos minutos: volvé a probar.`
                : `Las entradas del código ${formatAccessCode(codeForEvent.code)} están reservadas en una compra que todavía no se pagó. Si el pago no salió, esperá unos minutos y volvé a probar.`}{' '}
              Si tenés dudas, escribinos por Instagram.
            </p>
          </Card>
        ) : canBuy ? (
          <Card className="mt-12 p-4 sm:p-6 md:p-8">
            <h2 className="text-xl font-bold tracking-tight">Comprá tu entrada</h2>
            {accessCode && (
              <p role="status" className="mt-5 rounded-card border border-violet/40 bg-violet/10 px-4 py-3 text-sm text-bone/85">
                Entraste con el código <strong className="font-semibold">{formatAccessCode(accessCode.code)}</strong>.{' '}
                {accessCode.kind === 'public'
                  ? 'Con este código podés sacar 1 entrada: si vienen amigos, cada uno saca la suya.'
                  : accessCode.left === 1
                    ? 'Te queda 1 entrada.'
                    : `Te quedan ${accessCode.left} entradas.`}
              </p>
            )}
            <div className="mt-7">
              <BuyForm
                tandas={event.tandas}
                initialTanda={presaleTier?.id ?? searchParams.tanda}
                presaleCode={presaleTier ? searchParams.preventa : undefined}
                methods={{ mercadopago: sale.mpEnabled, transfer: sale.transferEnabled }}
                transferDetails={sale.transferDetails}
                maxPerOrder={maxPerOrder}
                accountsEnabled={accountsOn}
                ig={{ handle: igHandle, href: igUrl(igHandle) }}
                transport={transport.map((o) => ({
                  id: o.id,
                  name: o.name,
                  departure: o.departure,
                  price: o.price,
                  left: o.left,
                }))}
                account={
                  customer && {
                    email: customer.email,
                    name: customer.profile?.name ?? '',
                    document: customer.profile ? formatDocument(customer.profile.document) : '',
                    phone: customer.profile?.phone ?? '',
                  }
                }
              />
            </div>
          </Card>
        ) : (
          <Card className="mt-12 p-4 sm:p-6 md:p-8">
            <h2 className="text-xl font-bold tracking-tight">
              {soldOut ? 'Entradas agotadas' : 'La venta todavía no está abierta'}
            </h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-bone/65">
              {soldOut
                ? 'Se vendieron todas las entradas de esta fecha. Si se libera algún lugar, lo avisamos por Instagram.'
                : 'Avisamos por Instagram cuando arranca cada tanda. La entrada es personal: una por persona, a tu nombre y con tu CI.'}
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
    </div>
  );
}
