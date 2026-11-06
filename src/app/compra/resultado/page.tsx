import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { getCustomer } from '@/lib/customers';
import { isMercadoPagoConfigured, syncPayment } from '@/lib/mercadopago';
import { allowAttempt } from '@/lib/rate-limit';
import { getIgHandle, igUrl } from '@/lib/site';
import { normalizeEmail } from '@/lib/validation/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { PURCHASE_COOKIE, ticketUrl } from '@/lib/tickets';

export const metadata: Metadata = { title: 'Tu compra', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Adonde vuelve la persona desde Mercado Pago. MP agrega a la URL ?payment_id=…&status=…
// &external_reference=<id de la entrada>.
// No confiamos en esos parámetros: con el payment_id le preguntamos a MP el estado real
// (syncPayment), y si está aprobado confirmamos la entrada acá mismo. Así la compra
// funciona aunque el webhook todavía no haya llegado (o falle).
// Con transferencia vuelve con ?transferencia=<id de la entrada>: no hay pago que consultar,
// se muestra el estado de la validación.
// No pide el código de acceso: el acceso se cierra al ir a pagar y tiene que ver su entrada igual.
export default async function CompraResultadoPage({
  searchParams,
}: {
  searchParams: {
    payment_id?: string;
    collection_id?: string;
    external_reference?: string;
    preference_id?: string;
    transferencia?: string;
  };
}) {
  const paymentId = searchParams.payment_id ?? searchParams.collection_id;
  let ticketId = searchParams.transferencia ?? searchParams.external_reference ?? null;
  let mpStatus: string | null = null;
  let syncFailed = false;

  if (paymentId && paymentId !== 'null' && isMercadoPagoConfigured()) {
    try {
      if (!(await allowAttempt('result'))) throw new Error('límite de consultas');
      const synced = await syncPayment(paymentId);
      ticketId = synced.ticketId ?? ticketId;
      mpStatus = synced.status;
    } catch (err) {
      console.error('[compra/resultado] no se pudo consultar el pago', paymentId, (err as Error)?.message);
      syncFailed = true;
    }
  }

  const db = createAdminClient();
  const ticket =
    ticketId && /^[0-9a-f-]{36}$/.test(ticketId)
      ? (
          await db
            .from('tickets')
            .select('id, order_id, status, qr_token, buyer_name, buyer_email_normalized, customer_id, mp_preference_id')
            .eq('id', ticketId)
            .maybeSingle()
        ).data
      : null;
  // Compra de varias entradas (§5.2e): las de los amigos de quien compró, para decirle que a
  // cada uno le llega la suya.
  const others =
    ticket && ticket.order_id === ticket.id
      ? ((await db.from('tickets').select('status').eq('order_id', ticket.id).neq('id', ticket.id)).data ?? [])
      : [];

  // El link de la entrada (y el nombre) solo para quien la compró: este navegador, la vuelta
  // de esa misma preferencia de MP o la cuenta que la compró.
  const [customer, igHandle] = await Promise.all([getCustomer(), getIgHandle()]);
  const instagram = (
    <a href={igUrl(igHandle)} target="_blank" rel="noreferrer" className="text-bone underline decoration-bone/40 underline-offset-4">
      Instagram
    </a>
  );
  const isBuyer =
    !!ticket &&
    (cookies().get(PURCHASE_COOKIE)?.value === ticketId ||
      (!!searchParams.preference_id && searchParams.preference_id === ticket.mp_preference_id) ||
      (!!customer &&
        (ticket.customer_id === customer.id ||
          (customer.verified && normalizeEmail(customer.email) === ticket.buyer_email_normalized))));
  const firstName = isBuyer ? ` ${ticket!.buyer_name.split(' ')[0]}` : '';

  const paid = ticket && (ticket.status === 'paid' || ticket.status === 'used') && ticket.qr_token;
  const inReview = ticket?.status === 'review';
  const rejected = !!searchParams.transferencia && ticket?.status === 'cancelled';
  const waiting = !paid && (mpStatus === 'pending' || mpStatus === 'in_process' || mpStatus === 'authorized');
  // MP aprobó pero la entrada no quedó confirmada (falla de la base, pago para revisar):
  // nunca decirle que no se le cobró ni invitarla a pagar de nuevo.
  const paidUnconfirmed = !paid && mpStatus === 'approved';
  const loggedIn = (paid || inReview || waiting || paidUnconfirmed) && !!customer;
  const othersPaid = others.filter((o) => o.status === 'paid' || o.status === 'used').length;
  const othersInReview = others.filter((o) => o.status === 'review').length;

  return (
    <main id="contenido" className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" aria-label="House Mates, inicio" className="self-start">
        <Logo className="h-14" />
      </Link>
      <Card className="mt-10 p-6 md:p-8">
        {paid ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Listo{firstName ? `,${firstName}` : ''}. Ya tenés tu entrada.</h1>
            {othersPaid > 0 && (
              <p className="mt-3 text-sm text-bone/85">
                {othersPaid === 1
                  ? 'La otra entrada le llega a esa persona a su mail.'
                  : `Las otras ${othersPaid} entradas les llegan a cada uno a su mail.`}
              </p>
            )}
            {isBuyer ? (
              <>
                <p className="mt-3 text-sm text-bone/65">
                  Guardá el link de tu entrada: es lo que mostrás en puerta junto con tu cédula.
                </p>
                <Link href={ticketUrl(ticket.qr_token!).replace(/^https?:\/\/[^/]+/, '')} className={buttonVariants({ size: 'lg', className: 'mt-7 w-full' })}>
                  Ver mi entrada
                </Link>
              </>
            ) : (
              <p className="mt-3 text-sm text-bone/65">
                Te la mandamos por mail con el QR. Si no la ves, revisá también la carpeta de spam.
              </p>
            )}
          </>
        ) : inReview ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              Recibimos tu comprobante{firstName ? `,${firstName}` : ''}.
            </h1>
            {othersInReview > 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-bone/65">
                Lo estamos validando. Cuando lo validemos, a cada uno le llega su entrada con el QR a
                su mail (son {othersInReview + 1}). Los lugares quedan reservados mientras tanto.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-bone/65">
                Lo estamos validando. Cuando confirmemos la transferencia te mandamos la entrada con
                el QR por mail. Tu lugar queda reservado mientras tanto.
              </p>
            )}
            <p className="mt-3 text-xs text-bone/55">Si no te llega, revisá también la carpeta de spam.</p>
          </>
        ) : rejected ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">No pudimos validar tu transferencia</h1>
            <p className="mt-3 text-sm text-bone/65">
              Si ya transferiste, escribinos por {instagram} con el comprobante y lo revisamos.
            </p>
          </>
        ) : paidUnconfirmed ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Recibimos tu pago</h1>
            <p className="mt-3 text-sm leading-relaxed text-bone/65">
              Lo estamos revisando. No vuelvas a pagar: te escribimos por mail apenas lo
              confirmemos.
            </p>
            <p className="mt-3 text-xs text-bone/55">
              Si en una hora no tenés novedades, escribinos por {instagram}.
            </p>
          </>
        ) : syncFailed ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">No pudimos consultar tu pago</h1>
            <p className="mt-3 text-sm leading-relaxed text-bone/65">
              No vuelvas a pagar. Recargá esta página en unos minutos: si el pago se aprobó, tu
              entrada también te llega por mail.
            </p>
          </>
        ) : waiting ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Tu pago está en proceso</h1>
            <p className="mt-3 text-sm text-bone/65">
              Si pagaste en efectivo (Abitab o RedPagos) puede tardar un poco. Cuando se acredite te
              mandamos la entrada por mail.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">El pago no se completó</h1>
            <p className="mt-3 text-sm text-bone/65">
              No se te cobró nada. Podés volver a intentarlo: tu lugar se libera solo.
            </p>
            <Link href="/entradas" className={buttonVariants({ size: 'lg', className: 'mt-7 w-full' })}>
              Volver a intentar
            </Link>
          </>
        )}
      </Card>
      {loggedIn && (
        <p className="mt-5 text-center text-sm text-bone/60">
          Tu entrada también queda en{' '}
          <Link href="/cuenta" className="text-bone underline decoration-bone/40 underline-offset-4">
            Mi cuenta
          </Link>
          .
        </p>
      )}
    </main>
  );
}
