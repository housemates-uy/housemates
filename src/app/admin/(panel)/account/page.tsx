import { requireAdmin } from '@/lib/auth/admin';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Mi cuenta' };

export default async function AccountPage({ searchParams }: { searchParams: { set?: string } }) {
  const admin = await requireAdmin();
  const firstTime = searchParams.set === '1';

  return (
    <div className="max-w-xl space-y-8">
      <PageHeader title="Mi cuenta" description={admin.email} />

      {firstTime && (
        <Card className="text-sm text-bone/75">
          Elegí tu contraseña para entrar al admin de acá en adelante.
        </Card>
      )}

      <section className="space-y-5">
        <h2 className="text-lg font-bold tracking-tight">Contraseña</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
