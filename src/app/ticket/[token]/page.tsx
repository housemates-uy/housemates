import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';
import { entryTime, formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, qrSvg, ticketUrl } from '@/lib/tickets';
import { getTicketTransport } from '@/lib/transport';
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
// La cédula va completa (decisión de los owners): en puerta se coteja con el documento.
const STATE: Record<TicketStatus, { label: string; dot: string }> = {
  paid: { label: 'Válida', dot: 'bg-violet' },
  used: { label: 'Usada', dot: 'bg-violet' },
  pending: { label: 'Pago pendiente', dot: 'bg-bone/50' },
  review: { label: 'En revisión', dot: 'bg-bone/50' },
  cancelled: { label: 'Anulada', dot: 'bg-alert' },
  refunded: { label: 'Anulada', dot: 'bg-alert' },
};

export default async function TicketPage({ params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('id, buyer_name, buyer_document, status, used_at, source, tier_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!ticket || !ticket.qr_token) notFound();

  const [{ data: event }, { data: tier }, bus] = await Promise.all([
    db.from('events').select('title, date_start, format').eq('id', ticket.event_id).single(),
    ticket.tier_id
      ? db.from('ticket_tiers').select('name, entry_until').eq('id', ticket.tier_id).single()
      : Promise.resolve({ data: null }),
    getTicketTransport(ticket.id),
  ]);

  const valid = ticket.status === 'paid';
  const svg = valid ? await qrSvg(ticketUrl(ticket.qr_token)) : null;
  const doc = formatDocument(ticket.buyer_document);
  const state = STATE[ticket.status];
  const entryLabel = ticket.source === 'invitation' ? 'Cortesía' : (tier?.name ?? 'Entrada');
  // Tanda de ingreso temprano: hay que entrar antes de esa hora (en puerta se avisa si no).
  const entryUntil = ticket.status !== 'used' ? entryTime(tier?.entry_until) : null;
  // El QR se achica por cada renglón que suman el bus (unos 46 caracteres por renglón) y el
  // "Ingreso hasta", para que la entrada siga entrando en una pantalla de celular.
  const busLines = bus
    ? bus.departure.split('\n').reduce((n, line) => n + (line.trim() ? Math.ceil(line.trim().length / 46) : 0), 0)
    : 0;
  const qrOffset = (bus ? 22 + busLines * 17 : 0) + (entryUntil ? 22 : 0);

  return (
    <main
      id="contenido"
      className="print-ink relative isolate min-h-[100dvh] overflow-hidden print:min-h-0 print:bg-white"
    >
      <LiveRefresh active={valid || ticket.status === 'pending' || ticket.status === 'review'} />
      <DoodleBackdrop className="-z-10 print:hidden" />

      {/* Entra en una pantalla; si el texto del bus es largo, la página baja un poco. */}
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center gap-[1.6dvh] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] print:min-h-0">
        <Logo className="h-[clamp(48px,10dvh,112px)] shrink-0 print:text-ink" />

        {event && (
          <div className="shrink-0 text-center">
            <h1 className="text-[clamp(2.5rem,7dvh,3.5rem)] font-bold leading-[0.9] tracking-[-0.045em]">
              {formatLocal(event.date_start, 'dd.MM.yy')}
            </h1>
            <p className="mt-2 text-sm text-bone/80 first-letter:uppercase">
              {formatLocal(event.date_start, "EEEE · HH:mm 'hs'")} · {event.format}
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
                className="aspect-square [&>svg]:h-full [&>svg]:w-full"
                style={{ width: `max(150px, min(208px, calc(27dvh - ${qrOffset}px)))` }}
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
              {ticket.status === 'review' && (
                <>
                  <p className="text-xl font-bold">Validando tu transferencia</p>
                  <p className="text-sm text-bone/65">Cuando la confirmemos, aparece tu QR acá y te llega por mail.</p>
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
              CI {doc}
            </p>
            {entryUntil && (
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em]">Ingreso hasta {entryUntil}</p>
            )}
            {bus && (
              <>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em]">Bus · {bus.name}</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-snug text-bone/70">{bus.departure}</p>
              </>
            )}
          </div>
        </section>

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
