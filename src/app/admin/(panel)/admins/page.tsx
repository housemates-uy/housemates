import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/card';
import { formatLocal } from '@/lib/events';

export const metadata = { title: 'Administradores' };

export default async function AdminsPage() {
  const currentAdmin = await getAdminUser();
  if (!currentAdmin) redirect('/admin/login');
  if (currentAdmin.role !== 'owner') redirect('/admin');

  const db = createAdminClient();
  const { data: admins } = await db
    .from('admins')
    .select('id, name, email, role, active, last_login_at, created_at')
    .order('created_at', { ascending: true });

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Administradores"
        description={`${admins?.length ?? 0} usuarios. Se dan de alta desde Supabase.`}
      />

      {admins && admins.length > 0 ? (
        <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
          {admins.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="mt-0.5 truncate text-xs text-bone/55">{a.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={a.role === 'owner' ? 'solid' : 'neutral'}>{a.role}</Badge>
                {!a.active && <Badge>Inactivo</Badge>}
                {a.last_login_at && (
                  <span className="text-xs text-bone/50">
                    Último acceso {formatLocal(a.last_login_at, 'd MMM yyyy')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Sin administradores registrados" />
      )}
    </div>
  );
}
