import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/admin';
import { formatLocal } from '@/lib/events';
import { PrintButton } from '../../lista/imprimir/print-button';
import { getPassengers } from '../passengers';

export const metadata = { title: 'Lista del bus' };

// Igual que la lista de puerta: al imprimir queda solo la hoja, en negro sobre blanco. Cada
// opción de bus empieza en una hoja nueva, así cada chofer se lleva la suya.
const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm 10mm 14mm; @bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; } }
@media print {
  html, body { background: #fff !important; color-scheme: light; min-height: 0 !important; }
  body:has(#lista-bus) aside,
  body:has(#lista-bus) header,
  body:has(#lista-bus) nav,
  #contenido > div > :not(#lista-bus),
  #lista-bus [data-screen-only] { display: none !important; }
  body:has(#lista-bus) > div { padding: 0 !important; min-height: 0 !important; }
  #contenido { padding: 0 !important; }
  #lista-bus { margin: 0 !important; max-width: none !important; }
  #lista-bus .paper { background: #fff !important; border-radius: 0; padding: 0; }
  #lista-bus .paper + .paper { break-before: page; }
  #lista-bus tr { break-inside: avoid; }
}
`;

export default async function PrintBusListPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { opcion?: string };
}) {
  await requireAdmin();
  const data = await getPassengers(params.id);
  if (!data) notFound();

  const { event } = data;
  // Sin ?opcion=: una hoja por opción activa o con pasajeros (las desactivadas y vacías no).
  const options = searchParams.opcion
    ? data.options.filter((o) => o.id === searchParams.opcion)
    : data.options.filter((o) => o.active || o.confirmed.length > 0);
  const base = `/admin/events/${params.id}/transporte`;
  const printedAt = formatLocal(new Date().toISOString(), "dd/MM/yyyy 'a las' HH:mm");

  return (
    <div id="lista-bus" className="max-w-4xl space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div data-screen-only className="flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className="inline-flex items-center gap-1.5 text-sm text-bone/55 hover:text-bone">
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Transporte
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${base}/pasajeros${searchParams.opcion ? `?opcion=${searchParams.opcion}` : ''}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Download size={14} strokeWidth={1.5} aria-hidden />
            Descargar CSV
          </a>
          <PrintButton />
        </div>
      </div>

      {options.length === 0 && (
        <p className="py-12 text-center text-sm text-bone/60">Este evento no tiene opciones de transporte.</p>
      )}

      {options.map((o) => (
        <article key={o.id} className="paper rounded-card bg-bone p-5 text-ink md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-ink pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-label">Lista del bus · {event.title}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">{o.name}</h2>
              <p className="mt-0.5 whitespace-pre-line text-sm">{o.departure}</p>
              <p className="mt-0.5 text-sm first-letter:uppercase">
                Fiesta: {formatLocal(event.date_start, "EEEE d 'de' MMMM 'de' yyyy · HH:mm 'hs'")}
              </p>
            </div>
            <div className="text-xs sm:text-right">
              <p className="font-bold">
                {o.confirmed.length} {o.confirmed.length === 1 ? 'pasajero' : 'pasajeros'}
                {o.capacity !== null && ` · cupo ${o.capacity}`}
              </p>
              <p className="mt-0.5 text-ink/60">Impresa el {printedAt}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink/60">
            Pedí la cédula al subir y tildá la casilla. Solo figuran las entradas válidas.
          </p>

          {o.confirmed.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink/60">Todavía no hay pasajeros con la entrada válida.</p>
          ) : (
            <div className="mt-4 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[30rem] border-collapse text-sm print:min-w-0 print:text-[9.5pt]">
                <thead>
                  <tr className="border-b border-ink text-left text-[10px] font-bold uppercase tracking-[0.12em]">
                    <th scope="col" className="w-8 py-2 pr-2">
                      <span className="sr-only">Subió</span>
                    </th>
                    <th scope="col" className="w-8 py-2 pr-2 text-right">
                      #
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Nombre
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Cédula
                    </th>
                    <th scope="col" className="py-2">
                      Celular
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {o.confirmed.map((p, i) => (
                    <tr key={`${p.document}-${p.email}`} className="border-b border-ink/20">
                      <td className="py-1.5 pr-2 print:py-1">
                        <span className="flex h-4 w-4 border border-ink" />
                      </td>
                      <td className="py-1.5 pr-2 text-right text-xs tabular-nums text-ink/50 print:py-1">{i + 1}</td>
                      <td className="py-1.5 pr-3 font-medium print:py-1">{p.name}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums print:py-1">{p.document}</td>
                      <td className="whitespace-nowrap py-1.5 tabular-nums print:py-1">{p.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
