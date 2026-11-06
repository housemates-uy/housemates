import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { duplicateEventAction } from './actions';
import { DuplicateForm } from './duplicate-form';

export const metadata = { title: 'Duplicar evento' };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Copiar el evento a otra fecha: solo los owners (como el alta y la edición).
export default async function DuplicateEventPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin.role !== 'owner') redirect(`/admin/events/${params.id}`);
  const db = createAdminClient();

  const [{ data: event }, { count: tiers }, { count: options }, { count: products }] = await Promise.all([
    db.from('events').select('title, date_start, date_end').eq('id', params.id).single(),
    db.from('ticket_tiers').select('id', { count: 'exact', head: true }).eq('event_id', params.id),
    db.from('transport_options').select('id', { count: 'exact', head: true }).eq('event_id', params.id),
    db.from('bar_products').select('id', { count: 'exact', head: true }).eq('event_id', params.id),
  ]);
  if (!event) notFound();

  const durationMinutes = Math.round((Date.parse(event.date_end) - Date.parse(event.date_start)) / 60_000);
  const copied = [
    'El lugar, la capacidad, el formato y la descripción.',
    tiers &&
      `${plural(tiers, 'tanda', 'tandas')} con precio, cupo, ingreso temprano y código de preventa. Arrancan sin vendidas y sin fecha de salida a la venta.`,
    options && `${plural(options, 'opción', 'opciones')} de transporte, con salida, precio y cupo.`,
    products && `${plural(products, 'trago', 'tragos')} de la carta de la barra, con sus precios.`,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Duplicar para otra fecha</h2>
        <p className="mt-1 text-sm text-bone/55">
          Crea un evento nuevo igual a este, con el título y las fechas que elijas. Queda como borrador y con
          las ventas apagadas: nadie lo ve hasta que lo publiques.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-bone/10 p-4 sm:p-5">
          <h3 className="text-sm font-medium text-bone/70">Se copia</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-bone/65">
            {copied.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-card border border-bone/10 p-4 sm:p-5">
          <h3 className="text-sm font-medium text-bone/70">No se copia</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-bone/65">
            <li>Entradas, compras ni check-ins.</li>
            <li>Códigos de descuento ni de acceso.</li>
            <li>Pedidos de barra, comunicaciones ni encuestas.</li>
          </ul>
        </section>
      </div>

      <DuplicateForm
        action={duplicateEventAction.bind(null, params.id)}
        title={event.title}
        durationMinutes={durationMinutes}
        cancelHref={`/admin/events/${params.id}`}
      />
    </div>
  );
}
