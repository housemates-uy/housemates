import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, Download } from 'lucide-react';
import { LiveRefresh } from '@/app/ticket/[token]/live-refresh';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';
import { barUnitUrl } from '@/lib/bar';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { qrSvg } from '@/lib/tickets';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Trago de barra', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Un solo trago: /barra/qr/<token>. Es lo que abre la cámara del celular al escanear un QR de
// barra, y lo que ve alguien a quien le pasaron un QR (para invitarle un trago). No muestra
// datos del comprador ni el resto del pedido.
export default async function BarUnitPage({ params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: unit } = await db
    .from('bar_order_units')
    .select('product_name, delivered_at, order_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!unit) notFound();

  const [{ data: order }, { data: event }] = await Promise.all([
    db.from('bar_orders').select('status').eq('id', unit.order_id).single(),
    db.from('events').select('title, date_start').eq('id', unit.event_id).single(),
  ]);
  const valid = order?.status === 'paid' && !unit.delivered_at;
  const svg = valid ? await qrSvg(barUnitUrl(unit.qr_token)) : null;
  const pendingPayment = order?.status === 'pending';

  return (
    <main
      id="contenido"
      className="print-ink relative isolate min-h-[100dvh] print:min-h-0 print:bg-white"
    >
      <LiveRefresh active={valid || pendingPayment} />
      <DoodleBackdrop className="-z-10 print:hidden" />
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center gap-[2dvh] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] print:min-h-0">
        <Link href="/" aria-label="House Mates, inicio" className="shrink-0 print:text-ink">
          <Logo className="h-[clamp(52px,11dvh,112px)]" />
        </Link>
        <p className="shrink-0 text-[11px] font-bold uppercase tracking-label text-bone/55">
          Barra{event && ` · ${formatLocal(event.date_start, 'dd.MM.yy')}`}
        </p>

        <section
          aria-label="Trago"
          className="flex w-full flex-col items-center rounded-[22px] border border-bone/20 bg-ink/55 p-5 print:border-ink/30 print:bg-white"
        >
          <span className="flex items-center gap-1.5 self-end text-[11px] font-bold uppercase tracking-[0.16em]">
            <span
              aria-hidden
              className={cn(
                'h-2 w-2 rounded-full',
                valid ? 'bg-violet' : unit.delivered_at || pendingPayment ? 'bg-bone/40' : 'bg-alert',
              )}
            />
            {valid ? 'Para retirar' : unit.delivered_at ? 'Entregado' : pendingPayment ? 'Pago pendiente' : 'No válido'}
          </span>
          <h1 className="mt-3 text-center text-[clamp(1.5rem,5dvh,2rem)] font-bold leading-tight tracking-tight">
            {unit.product_name}
          </h1>
          {svg ? (
            <div className="mt-4 rounded-[14px] bg-white p-3">
              <div
                role="img"
                aria-label={`Código QR de ${unit.product_name}`}
                className="aspect-square w-[min(260px,64vw,calc(36dvh_-_58px))] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          ) : (
            <div className="mt-4 flex aspect-square w-[min(284px,70vw,calc(36dvh_-_34px))] flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-bone/20 px-4 text-center">
              {unit.delivered_at ? (
                <>
                  <Check size={40} strokeWidth={1.5} aria-hidden className="text-bone/70" />
                  <p className="text-xl font-bold">Ya se entregó</p>
                  <p className="text-sm text-bone/60">{formatLocal(unit.delivered_at, "d/MM 'a las' HH:mm")}</p>
                </>
              ) : pendingPayment ? (
                <>
                  <p className="text-xl font-bold">Pago en proceso</p>
                  <p className="text-sm text-bone/65">Cuando se confirme el pago, aparece el QR acá.</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold">QR anulado</p>
                  <p className="text-sm text-bone/65">Este trago ya no es válido.</p>
                </>
              )}
            </div>
          )}
        </section>

        <div className="mt-auto flex shrink-0 flex-col items-center gap-[2dvh]">
          {valid && (
            <a
              href={`/barra/qr/${unit.qr_token}/imagen`}
              download
              className="flex h-10 items-center justify-center gap-2 rounded-control border border-bone/25 px-4 text-sm text-bone/85 transition-colors hover:border-bone hover:text-bone print:hidden"
            >
              <Download size={16} strokeWidth={1.5} aria-hidden />
              Guardar imagen
            </a>
          )}
          <p className="text-center text-xs text-bone/60 print:text-ink/70">
            Mostralo en la barra · Vale un trago y se usa una sola vez
          </p>
        </div>
      </div>
    </main>
  );
}
