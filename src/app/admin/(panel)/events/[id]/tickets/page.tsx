import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/card';

export default async function EventTicketsPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const db = createAdminClient();

  const { count } = await db
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', params.id);

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-bone/55">{count ?? 0} tickets</p>
      <EmptyState title="La gestión de tickets llega con la ticketera">
        Acá vas a ver compradores, cargar entradas manuales y anular o reembolsar.
      </EmptyState>
    </div>
  );
}
