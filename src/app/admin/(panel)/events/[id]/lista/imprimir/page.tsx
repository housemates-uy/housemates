import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { buttonVariants } from '@/components/ui/button';
import { formatLocal } from '@/lib/events';
import { getDoorList, type DoorListRow } from '../door-list';
import { PrintButton } from './print-button';

export const metadata = { title: 'Lista de puerta' };

// Al imprimir queda solo la hoja: se esconden el menú del admin, el encabezado del evento
// y la barra de botones. Todo en negro sobre blanco.
const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm 10mm 14mm; @bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; } }
@media print {
  html, body { background: #fff !important; color-scheme: light; min-height: 0 !important; }
  body:has(#lista-puerta) aside,
  body:has(#lista-puerta) header,
  body:has(#lista-puerta) nav,
  #contenido > div > :not(#lista-puerta),
  #lista-puerta [data-screen-only] { display: none !important; }
  body:has(#lista-puerta) > div { padding: 0 !important; min-height: 0 !important; }
  #contenido { padding: 0 !important; }
  #lista-puerta { margin: 0 !important; max-width: none !important; }
  #lista-puerta .paper { background: #fff !important; border-radius: 0; padding: 0; }
  #lista-puerta tr { break-inside: avoid; }
}
`;

function initial(name: string): string {
  const first = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

function groupByInitial(rows: DoorListRow[]) {
  const groups: { letter: string; rows: { row: DoorListRow; n: number }[] }[] = [];
  rows.forEach((row, i) => {
    const letter = initial(row.name);
    const last = groups[groups.length - 1];
    if (last?.letter === letter) last.rows.push({ row, n: i + 1 });
    else groups.push({ letter, rows: [{ row, n: i + 1 }] });
  });
  return groups;
}

export default async function PrintDoorListPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const list = await getDoorList(params.id);
  if (!list) notFound();

  const { event, rows } = list;
  const inside = rows.filter((r) => r.usedAt).length;
  const groups = groupByInitial(rows);

  return (
    <div id="lista-puerta" className="max-w-4xl space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div data-screen-only className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/events/${params.id}/ventas`}
          className="inline-flex items-center gap-1.5 text-sm text-bone/55 hover:text-bone"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Ventas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/admin/events/${params.id}/lista`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Download size={14} strokeWidth={1.5} aria-hidden />
            Descargar CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <article className="paper rounded-card bg-bone p-5 text-ink md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-ink pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-label">Lista de puerta</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{event.title}</h2>
            <p className="mt-0.5 text-sm first-letter:uppercase">
              {formatLocal(event.date_start, "EEEE d 'de' MMMM 'de' yyyy · HH:mm 'hs'")}
            </p>
          </div>
          <div className="text-xs sm:text-right">
            <p className="font-bold">
              {rows.length} {rows.length === 1 ? 'entrada válida' : 'entradas válidas'}
              {inside > 0 && ` · ${inside} ya ${inside === 1 ? 'entró' : 'entraron'}`}
            </p>
            <p className="mt-0.5 text-ink/60">
              Impresa el {formatLocal(new Date().toISOString(), "dd/MM/yyyy 'a las' HH:mm")}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink/60">
          Pedí la cédula y cotejá nombre y número. Tildá la casilla cuando la persona entra.
        </p>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink/60">Todavía no hay entradas válidas.</p>
        ) : (
          <div className="mt-4 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[34rem] border-collapse text-sm print:min-w-0 print:text-[9.5pt]">
              <thead>
                <tr className="border-b border-ink text-left text-[10px] font-bold uppercase tracking-[0.12em]">
                  <th scope="col" className="w-8 py-2 pr-2">
                    <span className="sr-only">Entró</span>
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
                  <th scope="col" className="py-2 pr-3">
                    Tanda
                  </th>
                  <th scope="col" className="py-2">
                    Ingreso
                  </th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.letter}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={6}
                      className="pb-1 pt-3 text-left text-xs font-bold print:pt-2"
                    >
                      {g.letter}
                    </th>
                  </tr>
                  {g.rows.map(({ row, n }) => (
                    <tr key={n} className="border-b border-ink/20">
                      <td className="py-1.5 pr-2 print:py-1">
                        <span className="flex h-4 w-4 items-center justify-center border border-ink text-[11px] font-bold leading-none">
                          {row.usedAt ? '✓' : ''}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-xs tabular-nums text-ink/50 print:py-1">
                        {n}
                      </td>
                      <td className="py-1.5 pr-3 font-medium print:py-1">{row.name}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums print:py-1">
                        {row.document}
                      </td>
                      <td className="py-1.5 pr-3 print:py-1">{row.tier}</td>
                      <td className="whitespace-nowrap py-1.5 tabular-nums print:py-1">
                        {row.usedAt ? `Entró ${formatLocal(row.usedAt, 'HH:mm')}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
