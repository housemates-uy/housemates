import { entryTime } from '@/lib/events';
import { createAdminClient, fetchAll } from '@/lib/supabase/admin';
import { formatDocument, SOURCE_LABELS, STATUS_LABELS } from '@/lib/tickets';

export type DoorListRow = {
  name: string;
  document: string;
  email: string;
  phone: string;
  tier: string;
  origin: string;
  status: string;
  usedAt: string | null;
};

// Lista de la puerta (plan B si falla el escáner o internet): entradas válidas y ya usadas,
// por orden alfabético del nombre como lo escribió la persona.
export async function getDoorList(eventId: string) {
  const db = createAdminClient();
  const [{ data: event }, { data: tiers }, tickets] = await Promise.all([
    db.from('events').select('title, slug, date_start').eq('id', eventId).single(),
    db.from('ticket_tiers').select('id, name, entry_until').eq('event_id', eventId),
    // De a páginas: PostgREST corta en 1000 filas y a la lista de la puerta no le puede faltar nadie.
    fetchAll((from, to) =>
      db
        .from('tickets')
        .select(
          'buyer_name, buyer_document, buyer_email, buyer_phone, tier_id, source, payment_method, status, used_at',
        )
        .eq('event_id', eventId)
        .in('status', ['paid', 'used'])
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
  ]);
  if (!event) return null;

  // Las tandas de ingreso temprano llevan el horario: el portero lo ve en la lista impresa.
  const tierName = new Map(
    (tiers ?? []).map((t) => [t.id, t.entry_until ? `${t.name} · hasta ${entryTime(t.entry_until)}` : t.name]),
  );
  const rows: DoorListRow[] = tickets
    .map((t) => ({
      name: t.buyer_name.trim(),
      document: formatDocument(t.buyer_document),
      email: t.buyer_email,
      phone: t.buyer_phone ?? '',
      tier:
        t.source === 'invitation' ? 'Cortesía' : ((t.tier_id && tierName.get(t.tier_id)) ?? ''),
      origin:
        SOURCE_LABELS[t.source] +
        (t.source === 'purchase'
          ? t.payment_method === 'transfer'
            ? ' (transferencia)'
            : ' (Mercado Pago)'
          : ''),
      status: STATUS_LABELS[t.status],
      usedAt: t.used_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  return { event, rows };
}
