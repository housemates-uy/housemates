// ============================================================
// Transporte (bus) en la compra. Ver docs/LOGICA_DE_NEGOCIO.md → "Transporte".
// ============================================================
// Cada evento tiene opciones ("Ida", "Vuelta", "Ida y vuelta") con precio y cupo opcional.
// El cupo cuenta solo entradas vivas y lo garantiza `reserve_transport` en Postgres
// (supabase/migrations/0015_transport.sql), que se llama justo después de crear la entrada.
import { createAdminClient } from '@/lib/supabase/admin';

export type TransportOption = {
  id: string;
  name: string;
  departure: string; // punto y horario de salida, texto libre
  price: number;
  capacity: number | null; // null = sin cupo
  active: boolean;
  taken: number; // lugares de entradas vivas
  left: number | null; // null = sin cupo
};

export type TicketTransport = { name: string; departure: string; price: number };

const UUID = /^[0-9a-f-]{36}$/;

type OptionRow = {
  id: string;
  name: string;
  departure: string;
  price_uyu: number;
  capacity: number | null;
  active: boolean;
};

async function withSeats(rows: OptionRow[]): Promise<TransportOption[]> {
  const db = createAdminClient();
  return Promise.all(
    rows.map(async (o) => {
      const { data } = await db.rpc('transport_seats_taken', { p_option_id: o.id });
      const taken = (data as number | null) ?? 0;
      return {
        id: o.id,
        name: o.name,
        departure: o.departure,
        price: Number(o.price_uyu),
        capacity: o.capacity,
        active: o.active,
        taken,
        left: o.capacity === null ? null : Math.max(o.capacity - taken, 0),
      };
    }),
  );
}

const OPTION_COLUMNS = 'id, name, departure, price_uyu, capacity, active';

export async function getTransportOptions(eventId: string, { onlyActive = false } = {}): Promise<TransportOption[]> {
  let query = createAdminClient()
    .from('transport_options')
    .select(OPTION_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (onlyActive) query = query.eq('active', true);
  const { data } = await query;
  return withSeats(data ?? []);
}

// La opción elegida en /entradas (vacío = "No"). Se revisa antes de crear la
// entrada para avisar rápido; el cupo en serio lo garantiza reserve_transport dentro de
// create_order.
export async function findTransportChoice(
  eventId: string,
  raw: string,
): Promise<{ option: TransportOption | null } | { error: string }> {
  if (!raw) return { option: null };
  if (!UUID.test(raw)) return { error: 'Elegí una opción de transporte de la lista.' };
  const { data } = await createAdminClient()
    .from('transport_options')
    .select(OPTION_COLUMNS)
    .eq('id', raw)
    .eq('event_id', eventId)
    .eq('active', true)
    .maybeSingle();
  if (!data) return { error: 'Esa opción de transporte ya no está disponible. Elegí otra o seguí sin transporte.' };
  const [option] = await withSeats([data]);
  if (option.left === 0) return { error: fullMessage(option.name) };
  return { option };
}

const fullMessage = (name: string) =>
  `No quedan lugares en el bus "${name}". Elegí otra opción o seguí sin transporte.`;

// El transporte de cada entrada, por evento (admin) o por lista de entradas (Mis entradas).
export async function getTransportByTicket(
  filter: { eventId: string } | { ticketIds: string[] },
): Promise<Map<string, TicketTransport>> {
  if ('ticketIds' in filter && filter.ticketIds.length === 0) return new Map();
  let query = createAdminClient().from('ticket_transport').select('ticket_id, price_uyu, transport_options(name, departure)');
  query = 'eventId' in filter ? query.eq('event_id', filter.eventId) : query.in('ticket_id', filter.ticketIds);
  const { data } = await query;
  return new Map(
    (data ?? []).map((r) => {
      const o = r.transport_options as unknown as { name: string; departure: string } | null;
      return [r.ticket_id, { name: o?.name ?? 'Transporte', departure: o?.departure ?? '', price: Number(r.price_uyu) }];
    }),
  );
}

export async function getTicketTransport(ticketId: string): Promise<TicketTransport | null> {
  return (await getTransportByTicket({ ticketIds: [ticketId] })).get(ticketId) ?? null;
}
