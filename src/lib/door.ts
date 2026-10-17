import { createAdminClient } from '@/lib/supabase/admin';

// Contador de puerta: "entraron X de Y". Y = entradas válidas (pagas + ya usadas).
export async function doorCounts(eventId: string) {
  const db = createAdminClient();
  const [{ count: inside }, { count: total }] = await Promise.all([
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'used'),
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId).in('status', ['paid', 'used']),
  ]);
  return { inside: inside ?? 0, total: total ?? 0 };
}
