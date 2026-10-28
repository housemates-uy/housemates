import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/card';

export const metadata = { title: 'Whitelist' };

export default async function WhitelistPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { count } = await db
    .from('whitelist')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Whitelist"
        description={`${count ?? 0} email${count !== 1 ? 's' : ''} activo${count !== 1 ? 's' : ''}`}
      />
      <EmptyState title="Todavía no se puede gestionar desde acá">
        La carga y edición de emails llega con la ticketera.
      </EmptyState>
    </div>
  );
}
