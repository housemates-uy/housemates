import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TandaState } from '@/components/ui/tanda-status';
import { entryTime, formatLocal } from '@/lib/events';
import { priceBreakdown } from '@/lib/pricing';

const TZ = 'America/Montevideo';

// Link al pin de Google Maps: el que se cargó en el admin o, si no hay, una búsqueda por
// el nombre del lugar (Google abre directo la ficha cuando hay un solo resultado).
export function mapsUrl(locationName: string, locationUrl?: string | null): string {
  return locationUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;
}

// El "próximo evento" es el primero publicado que todavía no terminó. Es el que muestran
// la landing y /entradas, y el único para el que se puede comprar por la web.
export type NextEvent = {
  id: string | null;
  title: string | null;
  dateShort: string;
  weekday: string;
  dateLong: string;
  time: string; // "23:00", hora de Montevideo
  locationName: string | null;
  locationUrl: string | null;
  salesActive: boolean;
  // purchasable: se puede comprar ahora (activa, sin "agotado manual" y con lugares
  // libres descontando reservas en curso). price en UYU; fee y total incluyen el cargo
  // por servicio de la compra web (src/lib/pricing.ts).
  // state es lo que ve el público: "Disponible", "Sold out" o "Próximamente" (activa con
  // sales_start en el futuro: se ve con su precio pero no se puede elegir). El "% vendida" no
  // se muestra en la web a propósito (si se vende poco, no conviene que se note).
  // entryUntil: tanda de ingreso temprano ("00:30"). presale: tanda de preventa; solo viene
  // si se pidió con su código (getNextEvent({ presaleCode })), si no queda oculta.
  tandas: {
    id: string;
    name: string;
    state: TandaState;
    price: number;
    fee: number;
    total: number;
    purchasable: boolean;
    entryUntil: string | null;
    presale: boolean;
  }[];
};

function describeDate(iso: string) {
  const local = toZonedTime(new Date(iso), TZ);
  return {
    dateShort: format(local, 'dd.MM.yy'),
    weekday: format(local, 'EEEE', { locale: es }),
    dateLong: format(local, "d 'de' MMMM", { locale: es }),
    time: format(local, 'HH:mm'),
  };
}

export async function getNextEvent(opts: { presaleCode?: string | null } = {}): Promise<NextEvent> {
  const presaleCode = (opts.presaleCode ?? '').trim().toUpperCase();
  // Sin evento publicado, o si la base no respondió: id null y sin fecha ni lugar. Nunca se
  // inventa una fecha: la web muestra "Próxima fecha a confirmar".
  const fallback: NextEvent = {
    id: null,
    title: null,
    dateShort: '',
    weekday: '',
    dateLong: '',
    time: '',
    locationName: null,
    locationUrl: null,
    salesActive: false,
    tandas: [],
  };

  try {
    const db = createAdminClient({ timeoutMs: 2500 });
    const { data: event } = await db
      .from('events')
      .select('id, title, date_start, date_end, location_name, location_url, sales_active')
      .eq('status', 'published')
      .gte('date_end', new Date().toISOString())
      .order('date_start', { ascending: true })
      .limit(1)
      .maybeSingle()
      .retry(false);

    if (!event) return fallback;

    const { data: allTiers } = await db
      .from('ticket_tiers')
      .select('id, name, price_uyu, quantity_sold, quantity_total, sold_out_override, sales_start, entry_until, presale_code')
      .eq('event_id', event.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .retry(false);
    // Las de preventa se ven solo con su código (create_ticket lo vuelve a exigir al comprar).
    const tiers = (allTiers ?? []).filter((t) => !t.presale_code || t.presale_code === presaleCode);

    // Además del cupo de cada tanda, la capacidad del evento (create_ticket frena igual).
    const [eventLeft, ...tierLeft] = await Promise.all([
      db.rpc('event_available', { p_event_id: event.id }).retry(false).then(({ data }) => (data as number | null) ?? 0),
      ...tiers.map(async (t) => {
        const { data } = await db.rpc('tier_available', { p_tier_id: t.id }).retry(false);
        return (data as number | null) ?? 0;
      }),
    ]);
    const available = tierLeft.map((left) => Math.min(left, eventLeft));

    return {
      id: event.id,
      title: event.title,
      ...describeDate(event.date_start),
      locationName: event.location_name,
      locationUrl: event.location_url,
      salesActive: event.sales_active,
      tandas: tiers.map((t, i) => {
        const upcoming = !t.sold_out_override && !!t.sales_start && new Date(t.sales_start) > new Date();
        const purchasable = !upcoming && !t.sold_out_override && available[i] > 0;
        const state: TandaState = upcoming
          ? { kind: 'upcoming', opens: formatLocal(t.sales_start!, "EEE dd.MM · HH:mm 'hs'") }
          : purchasable
            ? { kind: 'available' }
            : { kind: 'sold_out' };
        return {
          id: t.id,
          name: t.name,
          state,
          ...priceBreakdown(Number(t.price_uyu)),
          purchasable,
          entryUntil: entryTime(t.entry_until),
          presale: !!t.presale_code,
        };
      }),
    };
  } catch {
    return fallback;
  }
}
