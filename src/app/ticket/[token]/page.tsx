import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/ui/logo';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { qrSvg, STATUS_LABELS, ticketUrl } from '@/lib/tickets';
import { LiveRefresh } from './live-refresh';

export const metadata: Metadata = { title: 'Tu entrada', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Página pública de una entrada: /ticket/<token>.
// Es lo que recibe el comprador (por WhatsApp o al terminar de pagar) y lo que muestra en
// puerta. Quien tenga el link ve la entrada, por eso la cédula se muestra parcial; la
// cédula completa la ve solo el portero en el scanner para cotejar con el documento.
export default async function TicketPage({ params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('buyer_name, buyer_document, status, used_at, source, tier_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!ticket || !ticket.qr_token) notFound();

  const [{ data: event }, { data: tier }] = await Promise.all([
    db.from('events').select('title, date_start, location_name').eq('id', ticket.event_id).single(),
    ticket.tier_id
      ? db.from('ticket_tiers').select('name').eq('id', ticket.tier_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const valid = ticket.status === 'paid';
  const svg = valid ? await qrSvg(ticketUrl(ticket.qr_token)) : null;
  const docTail = ticket.buyer_document.slice(-4);

  return (
    <main id="contenido" className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-8">
      <LiveRefresh active={valid || ticket.status === 'pending'} />
      <header className="flex items-center justify-between">
        <Logo className="h-11" />
        <Badge tone={valid ? 'solid' : ticket.status === 'used' ? 'club' : 'alert'}>
          {STATUS_LABELS[ticket.status]}
        </Badge>
      </header>

      <section className="mt-10">
        <p className="text-sm text-bone/55">{event?.title}</p>
        <h1 className="mt-1 text-[clamp(3rem,16vw,4.5rem)] font-bold leading-[0.9] tracking-[-0.04em]">
          {event ? formatLocal(event.date_start, 'dd.MM.yy') : ''}
        </h1>
        <p className="mt-3 text-sm text-bone/65 first-letter:uppercase">
          {event && formatLocal(event.date_start, "EEEE d 'de' MMMM, HH:mm 'hs'")}
        </p>
      </section>

      <div className="mt-8 rounded-card bg-bone p-5 text-ink">
        {svg ? (
          <div
            role="img"
            aria-label="Código QR de la entrada"
            className="mx-auto aspect-square w-full max-w-[18rem] [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="py-16 text-center text-base font-bold">
            {ticket.status === 'used' && `Entrada usada${ticket.used_at ? ` el ${formatLocal(ticket.used_at, "d/MM 'a las' HH:mm")}` : ''}`}
            {ticket.status === 'pending' && 'Estamos esperando la confirmación del pago.'}
            {(ticket.status === 'cancelled' || ticket.status === 'refunded') && 'Esta entrada fue anulada.'}
          </p>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-ink/10 pt-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-ink/55">Nombre</dt>
            <dd className="font-bold">{ticket.buyer_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/55">Cédula</dt>
            <dd className="font-medium">•••• {docTail.slice(0, 3)}-{docTail.slice(3)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/55">Entrada</dt>
            <dd className="font-medium">{ticket.source === 'invitation' ? 'Invitación' : (tier?.name ?? '—')}</dd>
          </div>
        </dl>
      </div>

      <ul className="mt-8 space-y-2 text-sm text-bone/60">
        <li>Es personal: en puerta te pedimos la cédula.</li>
        <li>Guardá este link o sacale captura al QR.</li>
        <li>Sirve para una sola entrada. No lo compartas.</li>
        {event?.location_name && <li>La ubicación exacta se comparte el día del evento.</li>}
      </ul>
    </main>
  );
}
