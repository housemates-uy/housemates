import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/components/admin/submit-button';
import { toggleDoorAction } from './actions';
import { Scanner } from './scanner';

export const metadata = { title: 'Puerta' };

export default async function EventScanPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const [{ data: event }, { count: inside }, { count: total }] = await Promise.all([
    db.from('events').select('door_closed').eq('id', params.id).single(),
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', params.id).eq('status', 'used'),
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', params.id).in('status', ['paid', 'used']),
  ]);
  const doorClosed = event?.door_closed ?? false;
  const toggleDoor = toggleDoorAction.bind(null, params.id, doorClosed);

  return (
    <div className="mx-auto max-w-md space-y-6">
      {doorClosed && (
        <p className="rounded-card border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          Puerta cerrada: todos los escaneos se rechazan.
        </p>
      )}
      <Scanner eventId={params.id} initial={{ inside: inside ?? 0, total: total ?? 0 }} />
      {admin.role === 'owner' && (
        <form action={toggleDoor} className="border-t border-bone/10 pt-6">
          <SubmitButton variant={doorClosed ? 'outline' : 'ghost'} size="sm">
            {doorClosed ? 'Reabrir puerta' : 'Cerrar puerta'}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
