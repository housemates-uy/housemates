import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/page-header';
import { StatCard } from '@/components/ui/card';
import { formatLocal } from '@/lib/events';

// Inicio: el próximo evento publicado, que sigue siendo "el próximo" mientras dura la fiesta
// (date_end en el futuro). Las entradas son las de ese evento, contadas como en Ventas.
export default async function AdminDashboard() {
  const admin = await getAdminUser();
  const db = createAdminClient();
  const now = new Date().toISOString();

  const [{ count: totalWhitelist }, { data: nextEvent }] = await Promise.all([
    db.from('whitelist').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db
      .from('events')
      .select('id, title, date_start, date_end, capacity')
      .eq('status', 'published')
      .gte('date_end', now)
      .order('date_start', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { count: validTickets } = nextEvent
    ? await db
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', nextEvent.id)
        .in('status', ['paid', 'used'])
    : { count: null };
  const happening = !!nextEvent && Date.parse(nextEvent.date_start) <= Date.now();

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title={`Bienvenido, ${admin?.name?.split(' ')[0] ?? ''}`}
        description="Panel de administración"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Entradas válidas"
          value={nextEvent ? (validTickets ?? 0) : '—'}
          sub={nextEvent ? `de ${nextEvent.capacity} lugares · próximo evento` : 'No hay ningún evento publicado'}
        />
        <StatCard label="Whitelist" value={totalWhitelist ?? 0} sub="Emails activos" />
        <StatCard
          className="sm:col-span-2 lg:col-span-1"
          label={happening ? 'Evento en curso' : 'Próximo evento'}
          value={
            nextEvent ? (
              <Link href={`/admin/events/${nextEvent.id}`} className="text-xl hover:underline">
                {nextEvent.title}
              </Link>
            ) : (
              <span className="text-xl">Sin evento</span>
            )
          }
          sub={
            nextEvent
              ? happening
                ? `Termina ${formatLocal(nextEvent.date_end, "d 'de' MMMM 'a las' HH:mm")}`
                : formatLocal(nextEvent.date_start, "d 'de' MMMM yyyy")
              : 'No hay ningún evento publicado'
          }
        />
      </div>
    </div>
  );
}
