import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomer, openedFromEmailLink } from '@/lib/customers';
import { createClient } from '@/lib/supabase/server';
import { AuthShell } from '../auth-shell';
import { NewPasswordForm } from './new-password-form';

export const metadata: Metadata = { title: 'Contraseña nueva', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Se llega desde un link del mail ("Confirmá tu email" o recupero), que ya abrió la sesión
// (/auth/confirm). Con la sesión de email + contraseña no se cambia la contraseña acá.
export default async function NuevaClavePage({ searchParams }: { searchParams: { confirmar?: string } }) {
  const customer = await getCustomer();
  if (!customer || !(await openedFromEmailLink(await createClient()))) redirect('/cuenta/recuperar');

  const confirming = searchParams.confirmar === '1';
  return (
    <AuthShell
      title={confirming ? 'Confirmá tu email' : 'Contraseña nueva'}
      intro={
        confirming ? (
          <>Para confirmar {customer.email}, elegí la contraseña de tu cuenta. Mínimo 8 caracteres.</>
        ) : (
          <>Para la cuenta {customer.email}. Mínimo 8 caracteres.</>
        )
      }
    >
      <NewPasswordForm email={customer.email} />
    </AuthShell>
  );
}
