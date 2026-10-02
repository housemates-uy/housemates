import { getAdminUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/page-header';
import { StatCard } from '@/components/ui/card';
import { formatLocal } from '@/lib/events';

export default async function AdminDashboard() {
  const admin = await getAdminUser();
  const db = createAdminClient();

  const [{ count: totalTickets }, { count: totalWhitelist }, { data: nextEvent }] =
    await Promise.all([
      db.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
      db.from('whitelist').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db
        .from('events')
        .select('id, title, date_start, sales_active, capacity')
        .eq('status', 'published')
        .gte('date_start', new Date().toISOString())
        .order('date_start', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title={`Bienvenido, ${admin?.name?.split(' ')[0] ?? ''}`}
        description="Panel de administración"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Tickets vendidos" value={totalTickets ?? 0} sub="Pagos confirmados" />
        <StatCard label="Whitelist" value={totalWhitelist ?? 0} sub="Emails activos" />
        <StatCard
          className="sm:col-span-2 lg:col-span-1"
          label="Próximo evento"
          value={<span className="text-xl">{nextEvent?.title ?? 'Sin evento'}</span>}
          sub={
            nextEvent
              ? formatLocal(nextEvent.date_start, "d 'de' MMMM yyyy")
              : 'No hay ningún evento publicado'
          }
        />
      </div>
    </div>
  );
}
