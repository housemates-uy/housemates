import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { qrSvg, ticketUrl } from '@/lib/tickets';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/database';
import { LiveRefresh } from './live-refresh';
import { SaveButtons } from './save-buttons';

export const metadata: Metadata = { title: 'Tu entrada', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Página pública de una entrada: /ticket/<token> (diseño "C · Doodle").
// Es lo que recibe el comprador (por WhatsApp o al terminar de pagar) y lo que muestra en
// puerta. Ocupa exactamente la pantalla del celular, sin scroll: los tamaños se ajustan a
// la altura (dvh) para que entre también en teléfonos chicos.
// Quien tenga el link ve la entrada, por eso la cédula se muestra parcial; la completa la
// ve solo el portero en el scanner para cotejar con el documento.
const STATE: Record<TicketStatus, { label: string; dot: string }> = {
  paid: { label: 'Válida', dot: 'bg-violet' },
  used: { label: 'Usada', dot: 'bg-violet' },
  pending: { label: 'Pago pendiente', dot: 'bg-bone/50' },
  cancelled: { label: 'Anulada', dot: 'bg-alert' },
  refunded: { label: 'Anulada', dot: 'bg-alert' },
};

export default async function TicketPage({ params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('buyer_name, buyer_document, status, used_at, source, tier_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!ticket || !ticket.qr_token) notFound();

  const [{ data: event }, { data: tier }] = await Promise.all([
    db.from('events').select('title, date_start').eq('id', ticket.event_id).single(),
    ticket.tier_id
      ? db.from('ticket_tiers').select('name').eq('id', ticket.tier_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const valid = ticket.status === 'paid';
  const svg = valid ? await qrSvg(ticketUrl(ticket.qr_token)) : null;
  const doc = ticket.buyer_document.slice(-4);
  const state = STATE[ticket.status];
  const entryLabel = ticket.source === 'invitation' ? 'Invitación' : (tier?.name ?? 'Entrada');

  return (
    <main
      id="contenido"
      className="print-ink relative isolate h-[100dvh] overflow-hidden print:h-auto print:bg-white"
    >
      <LiveRefresh active={valid || ticket.status === 'pending'} />
      <DoodleBackdrop className="-z-10 print:hidden" />

      <div className="mx-auto flex h-full max-w-md flex-col items-center gap-[2.2dvh] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))]">
        <Logo className="h-[clamp(64px,13dvh,112px)] shrink-0 print:text-ink" />

        {event && (
          <div className="shrink-0 text-center">
            <p className="text-[clamp(2.5rem,7dvh,3.5rem)] font-bold leading-[0.9] tracking-[-0.045em]">
              {formatLocal(event.date_start, 'dd.MM.yy')}
            </p>
            <p className="mt-2 text-sm text-bone/80 first-letter:uppercase">
              {formatLocal(event.date_start, "EEEE · HH:mm 'hs'")} · Open air
            </p>
          </div>
        )}

        <section
          aria-label="Entrada"
          className="flex w-full min-h-0 flex-col items-center gap-[1.8dvh] rounded-[22px] border border-bone/20 bg-ink/55 p-5 print:border-ink/30 print:bg-white"
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-bone/65">{entryLabel}</span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
              <span aria-hidden className={cn('h-2 w-2 rounded-full', state.dot)} />
              {state.label}
            </span>
          </div>

          {svg ? (
            <div className="rounded-[14px] bg-white p-3">
              <div
                role="img"
                aria-label="Código QR de la entrada"
                className="aspect-square w-[min(208px,27dvh)] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          ) : (
            <div className="flex aspect-square w-[min(232px,30dvh)] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-bone/25 px-4 text-center">
              {ticket.status === 'used' && (
                <>
                  <p className="text-xl font-bold">Ya entraste</p>
                  {ticket.used_at && (
                    <p className="text-sm text-bone/65">{formatLocal(ticket.used_at, "d/MM 'a las' HH:mm")}</p>
                  )}
                </>
              )}
              {ticket.status === 'pending' && (
                <>
                  <p className="text-xl font-bold">Pago en proceso</p>
                  <p className="text-sm text-bone/65">Cuando se confirme, aparece tu QR acá.</p>
                </>
              )}
              {(ticket.status === 'cancelled' || ticket.status === 'refunded') && (
                <>
                  <p className="text-xl font-bold">Entrada anulada</p>
                  <p className="text-sm text-bone/65">Esta entrada ya no es válida.</p>
                </>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-xl font-bold">{ticket.buyer_name}</p>
            <p className="mt-1 text-[13px] text-bone/70">
              CI •••• {doc.slice(0, 3)}-{doc.slice(3)}
            </p>
          </div>
        </section>

        {valid && <div className="mt-auto" />}
        {valid && <SaveButtons token={ticket.qr_token} />}
        <p className={cn('shrink-0 text-center text-xs text-bone/60 print:text-ink/70', !valid && 'mt-auto')}>
          {ticket.status === 'used'
            ? 'Esta entrada ya se usó en puerta. Que la pases bien.'
            : 'Entrada personal · En puerta te pedimos la cédula'}
        </p>
      </div>
    </main>
  );
}
