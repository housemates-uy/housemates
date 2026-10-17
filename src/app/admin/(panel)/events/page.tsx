import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/events/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { formatLocal } from '@/lib/events';

export const metadata = { title: 'Eventos' };

export default async function EventsPage() {
  await requireAdmin();
  const db = createAdminClient();

  const { data: events } = await db
    .from('events')
    .select('id, title, slug, date_start, status, capacity, sales_active')
    .order('date_start', { ascending: false });

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Eventos"
        description={`${events?.length ?? 0} evento${events?.length !== 1 ? 's' : ''}`}
        action={
          <Link href="/admin/events/new" className={buttonVariants({ size: 'sm' })}>
            Nuevo evento
          </Link>
        }
      />

      {events && events.length > 0 ? (
        <ul className="divide-y divide-bone/10 overflow-hidden rounded-card border border-bone/10">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/admin/events/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone/5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-0.5 text-xs text-bone/55">
                    {formatLocal(event.date_start, "d 'de' MMMM yyyy, HH:mm")} · {event.capacity} lugares
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {event.sales_active && <span className="text-xs text-bone/60">Ventas activas</span>}
                  <StatusBadge status={event.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Sin eventos">Creá el primero con “Nuevo evento”.</EmptyState>
      )}
    </div>
  );
}
