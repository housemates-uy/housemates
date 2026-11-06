import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';

// Crear eventos (con sus tandas y precios): solo los owners.
export default async function NewEventLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (admin.role !== 'owner') redirect('/admin/events');
  return children;
}
