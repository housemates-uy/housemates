import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { isMercadoPagoConfigured, syncPayment } from '@/lib/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { ticketUrl } from '@/lib/tickets';

export const metadata: Metadata = { title: 'Tu compra', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Adonde vuelve la persona desde Mercado Pago. MP agrega a la URL ?payment_id=…&status=…
// &external_reference=<id de la entrada>.
// No confiamos en esos parámetros: con el payment_id le preguntamos a MP el estado real
// (syncPayment), y si está aprobado confirmamos la entrada acá mismo. Así la compra
// funciona aunque el webhook todavía no haya llegado (o falle).
// No pide la contraseña del gate: si la rotaron mientras pagaba, igual tiene que ver su entrada.
export default async function CompraResultadoPage({
  searchParams,
}: {
  searchParams: { payment_id?: string; collection_id?: string; external_reference?: string };
}) {
  const paymentId = searchParams.payment_id ?? searchParams.collection_id;
  let ticketId = searchParams.external_reference ?? null;
  let mpStatus: string | null = null;

  if (paymentId && paymentId !== 'null' && isMercadoPagoConfigured()) {
    try {
      const synced = await syncPayment(paymentId);
      ticketId = synced.ticketId ?? ticketId;
      mpStatus = synced.status;
    } catch {
      mpStatus = null;
    }
  }

  const ticket =
    ticketId && /^[0-9a-f-]{36}$/.test(ticketId)
      ? (
          await createAdminClient()
            .from('tickets')
            .select('status, qr_token, buyer_name')
            .eq('id', ticketId)
            .maybeSingle()
        ).data
      : null;

  const paid = ticket && (ticket.status === 'paid' || ticket.status === 'used') && ticket.qr_token;
  const waiting = !paid && (mpStatus === 'pending' || mpStatus === 'in_process');

  return (
    <main id="contenido" className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-12">
      <Logo className="h-14 self-start" />
      <Card className="mt-10 p-6 md:p-8">
        {paid ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Listo, {ticket.buyer_name.split(' ')[0]}. Ya tenés tu entrada.</h1>
            <p className="mt-3 text-sm text-bone/65">
              Guardá el link de tu entrada: es lo que mostrás en puerta junto con tu cédula.
            </p>
            <Link href={ticketUrl(ticket.qr_token!).replace(/^https?:\/\/[^/]+/, '')} className={buttonVariants({ size: 'lg', className: 'mt-7 w-full' })}>
              Ver mi entrada
            </Link>
          </>
        ) : waiting ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Tu pago está en proceso</h1>
            <p className="mt-3 text-sm text-bone/65">
              Si pagaste en efectivo (Abitab o RedPagos) puede tardar un poco. Cuando se acredite te
              confirmamos por Instagram con el link de tu entrada.
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
    </main>
  );
}
