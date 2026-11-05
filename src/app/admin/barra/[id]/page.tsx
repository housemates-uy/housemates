import { notFound, redirect } from 'next/navigation';
import { getScanUser } from '@/lib/auth/admin';
import { barCounts } from '@/lib/bar';
import { createAdminClient } from '@/lib/supabase/admin';
import { BarScannerApp } from './bar-scanner';

export const metadata = { title: 'Barra' };
export const dynamic = 'force-dynamic';

// Escáner de barra. Igual que la puerta, vive fuera del layout del admin (sin menú) para
// ocupar toda la pantalla del celular. Lo usan owners y staff con cualquier evento; el
// usuario de barra entra solo por /scan, que le muestra la fiesta que corresponde.
export default async function BarScanPage({ params }: { params: { id: string } }) {
  const admin = await getScanUser();
  if (!admin) redirect('/admin/login');
  if (admin.role === 'barra') redirect('/scan');

  const { data: event } = await createAdminClient()
    .from('events')
    .select('id, title')
    .eq('id', params.id)
    .maybeSingle();
  if (!event) notFound();

  return (
    <BarScannerApp
      eventId={event.id}
      title={event.title}
      initial={await barCounts(event.id)}
      exitHref={`/admin/events/${event.id}/barra`}
    />
  );
}
