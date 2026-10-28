import { notFound, redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { barCounts } from '@/lib/bar';
import { createAdminClient } from '@/lib/supabase/admin';
import { BarScannerApp } from './bar-scanner';

export const metadata = { title: 'Barra' };
export const dynamic = 'force-dynamic';

// Escáner de barra. Igual que la puerta, vive fuera del layout del admin (sin menú) para
// ocupar toda la pantalla del celular. Lo puede usar cualquier admin, owner o staff.
export default async function BarScanPage({ params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');

  const { data: event } = await createAdminClient()
    .from('events')
    .select('id, title')
    .eq('id', params.id)
    .maybeSingle();
  if (!event) notFound();

  return <BarScannerApp eventId={event.id} title={event.title} initial={await barCounts(event.id)} />;
}
