import { redirect } from 'next/navigation';
import { isAccountsEnabled } from '@/lib/customers';

export const dynamic = 'force-dynamic';

// Con "Mi cuenta" apagada desde /admin/config, ninguna página de /cuenta existe para el público.
export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAccountsEnabled())) redirect('/');
  return children;
}
