import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TandaState } from '@/components/ui/tanda-status';
import { priceBreakdown } from '@/lib/pricing';

const TZ = 'America/Montevideo';

// Se usa mientras no haya un evento publicado en la base.
const FALLBACK_DATE = '2026-12-11T23:00:00-03:00';

// El "próximo evento" es el primero publicado que todavía no terminó. Es el que muestran
// la landing y /entradas, y el único para el que se puede comprar por la web.
export type NextEvent = {
  id: string | null;
  title: string | null;
  dateShort: string;
  weekday: string;
  dateLong: string;
  locationName: string | null;
  salesActive: boolean;
  // purchasable: se puede comprar ahora (activa, sin "agotado manual" y con lugares
  // libres descontando reservas en curso). price en UYU; fee y total incluyen el cargo
  // por servicio de la compra web (src/lib/pricing.ts).
  // state es lo que ve el público: solo "Disponible" o "Sold out". El "% vendida" no se
  // muestra en la web a propósito (si se vende poco, no conviene que se note).
  tandas: {
    id: string;
    name: string;
    state: TandaState;
    price: number;
    fee: number;
    total: number;
    purchasable: boolean;
  }[];
};

function describeDate(iso: string) {
  const local = toZonedTime(new Date(iso), TZ);
  return {
    dateShort: format(local, 'dd.MM.yy'),
    weekday: format(local, 'EEEE', { locale: es }),
    dateLong: format(local, "d 'de' MMMM", { locale: es }),
  };
}

export async function getNextEvent(): Promise<NextEvent> {
  const fallback: NextEvent = {
    id: null,
    title: null,
    ...describeDate(FALLBACK_DATE),
    locationName: null,
    salesActive: false,
    tandas: [],
  };

  try {
    const db = createAdminClient({ timeoutMs: 2500 });
    const { data: event } = await db
      .from('events')
      .select('id, title, date_start, date_end, location_name, sales_active')
      .eq('status', 'published')
      .gte('date_end', new Date().toISOString())
      .order('date_start', { ascending: true })
      .limit(1)
      .maybeSingle()
      .retry(false);

    if (!event) return fallback;

    const { data: tiers } = await db
      .from('ticket_tiers')
      .select('id, name, price_uyu, quantity_sold, quantity_total, sold_out_override')
      .eq('event_id', event.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .retry(false);

    const available = await Promise.all(
      (tiers ?? []).map(async (t) => {
        const { data } = await db.rpc('tier_available', { p_tier_id: t.id }).retry(false);
        return (data as number | null) ?? 0;
      }),
    );

    return {
      id: event.id,
      title: event.title,
      ...describeDate(event.date_start),
      locationName: event.location_name,
      salesActive: event.sales_active,
      tandas: (tiers ?? []).map((t, i) => {
        const purchasable = !t.sold_out_override && available[i] > 0;
        return {
          id: t.id,
          name: t.name,
          state: purchasable ? ({ kind: 'available' } as const) : ({ kind: 'sold_out' } as const),
          ...priceBreakdown(Number(t.price_uyu)),
          purchasable,
        };
      }),
    };
  } catch {
    return fallback;
  }
}
