import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LiveRefresh } from '@/app/ticket/[token]/live-refresh';
import { buttonVariants } from '@/components/ui/button';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';
import { barUnitUrl, groupUnits, loadBarOrderByToken, maskEmail } from '@/lib/bar';
import { formatLocal, formatUYU } from '@/lib/events';
import { isMercadoPagoConfigured, syncPayment } from '@/lib/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { qrSvg } from '@/lib/tickets';
import { PrintButton, UnitsCarousel } from './units-carousel';

export const metadata: Metadata = { title: 'Tu pedido de barra', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Página de un pedido de barra: /barra/pedido/<token>. Muestra un QR por trago, de a uno
// (deslizable), con el estado de cada uno. Es lo que se abre desde el mail y adonde vuelve
// la persona desde Mercado Pago.
// Al volver, MP agrega ?payment_id=…&status=…: igual que /compra/resultado, no se confía en
// eso, se le pregunta el estado a MP (syncPayment) y si está aprobado se confirma acá mismo.
// Una sola vez: después redirige a la misma página sin payment_id (queda ?status para el
// texto). Si no, el refresco de cada 5 s le preguntaría a MP sin límite.
// Mientras falte pagar o retirar algo, se refresca sola: cuando el barman entrega, el QR pasa
// a "Entregado" sin recargar. Con el pago rechazado, no.
export default async function BarOrderPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { payment_id?: string; collection_id?: string; status?: string; collection_status?: string };
}) {
  const order = await loadBarOrderByToken(params.token);
  if (!order) notFound();

  const paymentId = searchParams.payment_id ?? searchParams.collection_id;
  let mpStatus = searchParams.status ?? searchParams.collection_status ?? null;
  if (paymentId) {
    if (order.status === 'pending' && paymentId !== 'null' && isMercadoPagoConfigured()) {
      try {
        const synced = await syncPayment(paymentId);
        if (synced.barOrderId === order.id) mpStatus = synced.status;
      } catch {
        // Si MP no responde, queda pendiente: lo confirma el webhook.
      }
    }
    const keep = mpStatus && mpStatus !== 'approved' ? `?status=${encodeURIComponent(mpStatus)}` : '';
    redirect(`/barra/pedido/${params.token}${keep}`);
  }

  const { data: event } = await createAdminClient()
    .from('events')
    .select('title, date_start')
    .eq('id', order.eventId)
    .single();

  const paid = order.status === 'paid';
  const toPick = order.units.filter((u) => !u.deliveredAt).length;
  const delivered = order.units.length - toPick;
  const units = paid
    ? await Promise.all(
        order.units.map(async (u) => ({
          token: u.token,
          name: u.name,
          deliveredAt: u.deliveredAt,
          svg: u.deliveredAt ? null : await qrSvg(barUnitUrl(u.token)),
        })),
      )
    : [];
  const firstName = order.name?.split(' ')[0];
  const failed = mpStatus === 'null' || mpStatus === 'rejected' || mpStatus === 'cancelled';
  const inProcess = mpStatus === 'pending' || mpStatus === 'in_process';

  return (
    <main id="contenido" className="print-ink relative isolate min-h-[100dvh] print:bg-white">
      <LiveRefresh active={(order.status === 'pending' && !failed) || (paid && toPick > 0)} />
      <DoodleBackdrop className="fixed -z-10 print:hidden" />

      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Link href="/" aria-label="House Mates, inicio" className="print:text-ink">
          <Logo className="h-[clamp(56px,10dvh,88px)]" />
        </Link>

        <div className="mt-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-label text-bone/55">
            Barra{event && ` · ${formatLocal(event.date_start, 'dd.MM.yy')}`}
          </p>
          <h1 className="mt-2 text-[clamp(2.25rem,6.5dvh,3rem)] font-bold leading-[0.95] tracking-[-0.04em]">
            {firstName ? `${firstName}, tus tragos` : 'Tus tragos'}
          </h1>
          {paid && (
            <p aria-live="polite" className="mt-2 text-sm text-bone/75">
              {toPick === 0
                ? 'Ya retiraste todo. ¡Salud!'
                : `${delivered} ${delivered === 1 ? 'entregado' : 'entregados'} · ${toPick} para retirar`}
            </p>
          )}
        </div>

        {paid ? (
          <UnitsCarousel units={units} />
        ) : (
          <section className="mt-8 w-full rounded-[22px] border border-bone/20 bg-ink/55 p-6 text-center">
            {order.status === 'pending' && failed && (
              <>
                <p className="text-xl font-bold">El pago no se completó</p>
                <p className="mt-2 text-sm text-bone/65">No se te cobró nada. Podés volver a intentarlo.</p>
                <Link href="/barra" className={buttonVariants({ size: 'lg', className: 'mt-6 w-full' })}>
                  Volver a la barra
                </Link>
              </>
            )}
            {order.status === 'pending' && !failed && (
              <>
                <p className="text-xl font-bold">{inProcess ? 'Tu pago está en proceso' : 'Esperando el pago'}</p>
                <p className="mt-2 text-sm text-bone/65">
                  Cuando Mercado Pago lo confirme, aparecen tus QRs acá y te llegan por mail.
                </p>
              </>
            )}
            {(order.status === 'cancelled' || order.status === 'refunded') && (
              <>
                <p className="text-xl font-bold">Pedido anulado</p>
                <p className="mt-2 text-sm text-bone/65">
                  {order.status === 'refunded'
                    ? 'Te devolvimos la plata por Mercado Pago. Estos QRs ya no valen.'
                    : 'Este pedido no se cobró. Podés armar otro desde la barra.'}
                </p>
              </>
            )}
          </section>
        )}

        <dl className="mt-8 w-full space-y-2 rounded-card border border-bone/10 bg-ink/40 p-5 text-sm print:border-ink/30">
          {groupUnits(order.units).map((l) => (
            <div key={`${l.name}-${l.price}`} className="flex justify-between gap-4">
              <dt className="text-bone/70">
                {l.quantity} × {l.name}
              </dt>
              <dd>{formatUYU(l.quantity * l.price)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-bone/10 pt-3 text-base font-bold">
            <dt>{paid ? 'Total pagado' : 'Total'}</dt>
            <dd>{formatUYU(order.total)}</dd>
          </div>
          <p className="pt-1 text-xs text-bone/45">{maskEmail(order.email)}</p>
        </dl>

        {paid && toPick > 0 && <PrintButton />}
        <p className="mt-6 text-center text-xs text-bone/60 print:text-ink/70">
          Cada QR vale un trago y se usa una sola vez{event ? ` · ${event.title}` : ''}
        </p>
      </div>
    </main>
  );
}
