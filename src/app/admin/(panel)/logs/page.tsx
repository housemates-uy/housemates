import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/card';

export const metadata = { title: 'Logs' };

export default async function LogsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');
  if (admin.role !== 'owner') redirect('/admin');

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Historial de acciones" description="Auditoría de cambios del panel" />
      <EmptyState title="El historial todavía no se muestra">
        Las acciones ya se están registrando. La vista para consultarlas llega más adelante.
      </EmptyState>
    </div>
  );
}
