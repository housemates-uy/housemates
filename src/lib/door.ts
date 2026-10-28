import { createAdminClient } from '@/lib/supabase/admin';

// Contador de puerta: "entraron X de Y". Y = entradas válidas (pagas + ya usadas).
// Si falla alguna de las dos consultas devuelve 0 / 0, que la pantalla ignora (deja el último
// contador): nunca un número a medias.
export async function doorCounts(eventId: string) {
  const db = createAdminClient();
  const [used, valid] = await Promise.all([
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'used'),
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId).in('status', ['paid', 'used']),
  ]);
  if (used.error || valid.error) return { inside: 0, total: 0 };
  return { inside: used.count ?? 0, total: valid.count ?? 0 };
}
