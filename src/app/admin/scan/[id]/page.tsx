import { notFound, redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { doorCounts } from '@/lib/door';
import { ScannerApp } from './scanner';

export const metadata = { title: 'Puerta' };
export const dynamic = 'force-dynamic';

// Pantalla de puerta. Vive fuera del layout del admin (sin menú ni header) para ocupar
// toda la pantalla del celular, como una app. Requiere estar logueado como admin.
export default async function ScanPage({ params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');

  const db = createAdminClient();
  const { data: event } = await db.from('events').select('id, title, door_closed').eq('id', params.id).maybeSingle();
  if (!event) notFound();

  return (
    <ScannerApp
      eventId={event.id}
      title={event.title}
      doorClosed={event.door_closed}
      isOwner={admin.role === 'owner'}
      initial={await doorCounts(event.id)}
    />
  );
}
