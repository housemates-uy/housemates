import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '../../lista/imprimir/print-button';
import { Logo } from '@/components/ui/logo';
import { requireAdmin } from '@/lib/auth/admin';
import { barAccessUrl } from '@/lib/bar-access';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { qrSvg } from '@/lib/tickets';

export const metadata = { title: 'QR de la barra' };

// Cartel A4 con el QR de la barra, para pegar en la fiesta. Al imprimir queda solo la hoja,
// en negro sobre blanco (como la lista de puerta).
const PRINT_CSS = `
@page { size: A4 portrait; margin: 14mm; }
@media print {
  html, body { background: #fff !important; color-scheme: light; min-height: 0 !important; }
  body:has(#qr-barra) aside,
  body:has(#qr-barra) header,
  body:has(#qr-barra) nav,
  #contenido > div > :not(#qr-barra),
  #qr-barra [data-screen-only] { display: none !important; }
  body:has(#qr-barra) > div { padding: 0 !important; min-height: 0 !important; }
  #contenido { padding: 0 !important; }
  #qr-barra { margin: 0 !important; max-width: none !important; }
  #qr-barra .paper { border-radius: 0; padding: 0; min-height: 260mm; }
}
`;

export default async function PrintBarQrPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { data: event } = await createAdminClient()
    .from('events')
    .select('title, date_start, bar_key')
    .eq('id', params.id)
    .maybeSingle();
  if (!event) notFound();
  const svg = await qrSvg(barAccessUrl(event.bar_key));

  return (
    <div id="qr-barra" className="max-w-2xl space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div data-screen-only className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/events/${params.id}/barra`}
          className="inline-flex items-center gap-1.5 text-sm text-bone/55 hover:text-bone"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Barra
        </Link>
        <PrintButton />
      </div>

      <article className="paper flex flex-col items-center justify-center rounded-card bg-white px-6 py-12 text-center text-black md:py-16">
        <Logo className="h-20" />
        <p className="mt-8 text-xs font-bold uppercase tracking-label">Barra</p>
        <h2 className="mt-2 text-5xl font-bold leading-none tracking-tight">Pedí tus tragos</h2>
        <div
          role="img"
          aria-label="QR de la barra"
          className="mt-8 w-full max-w-[12cm] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-8 max-w-[34ch] text-lg leading-snug">
          Escaneá con la cámara, pagá con Mercado Pago y mostrá tu QR en la barra.
        </p>
        <p className="mt-6 text-sm first-letter:uppercase">
          {event.title} · {formatLocal(event.date_start, "EEEE d 'de' MMMM")}
        </p>
      </article>
    </div>
  );
}
