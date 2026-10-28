import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, STATUS_LABELS } from '@/lib/tickets';
import { getTransportOptions, type TransportOption } from '@/lib/transport';
import type { TicketStatus } from '@/types/database';

export type Passenger = {
  name: string;
  document: string;
  phone: string;
  email: string;
  status: TicketStatus;
  statusLabel: string;
  price: number;
};

export type OptionWithPassengers = TransportOption & {
  // Entradas vivas con esta opción: pagas, usadas, transferencias a validar y pagos en curso.
  passengers: Passenger[];
  // Las que van en la lista del chofer (CSV e imprimible): pagas o ya usadas.
  confirmed: Passenger[];
  // Alguna vez se reservó (aunque se haya anulado): no se puede borrar, solo desactivar.
  everReserved: boolean;
};

const byName = (a: Passenger, b: Passenger) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

// Pasajeros del bus por opción, por orden alfabético del nombre como lo escribió la persona.
export async function getPassengers(eventId: string) {
  const db = createAdminClient();
  const [{ data: event }, options, { data: rows }] = await Promise.all([
    db.from('events').select('title, slug, date_start').eq('id', eventId).single(),
    getTransportOptions(eventId),
    db
      .from('ticket_transport')
      .select('option_id, price_uyu, tickets!inner(buyer_name, buyer_document, buyer_phone, buyer_email, status, reserved_until)')
      .eq('event_id', eventId),
  ]);
  if (!event) return null;

  const now = Date.now();
  const all = (rows ?? []).map((r) => {
    const t = r.tickets as unknown as {
      buyer_name: string;
      buyer_document: string;
      buyer_phone: string | null;
      buyer_email: string;
      status: TicketStatus;
      reserved_until: string | null;
    };
    const live =
      t.status === 'review' ||
      t.status === 'paid' ||
      t.status === 'used' ||
      (t.status === 'pending' && !!t.reserved_until && new Date(t.reserved_until).getTime() > now);
    return {
      optionId: r.option_id,
      live,
      passenger: {
        name: t.buyer_name.trim(),
        document: formatDocument(t.buyer_document),
        phone: t.buyer_phone ?? '',
        email: t.buyer_email,
        status: t.status,
        statusLabel: STATUS_LABELS[t.status],
        price: Number(r.price_uyu),
      } satisfies Passenger,
    };
  });

  const withPassengers: OptionWithPassengers[] = options.map((o) => {
    const mine = all.filter((r) => r.optionId === o.id);
    const passengers = mine.filter((r) => r.live).map((r) => r.passenger).sort(byName);
    return {
      ...o,
      passengers,
      confirmed: passengers.filter((p) => p.status === 'paid' || p.status === 'used'),
      everReserved: mine.length > 0,
    };
  });

  return { event, options: withPassengers };
}
