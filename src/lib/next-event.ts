import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { tandaState, type TandaState } from '@/components/ui/tanda-status';

const TZ = 'America/Montevideo';

// Se usa mientras no haya un evento publicado en la base.
const FALLBACK_DATE = '2026-12-11T23:00:00-03:00';

export type NextEvent = {
  title: string | null;
  dateShort: string;
  weekday: string;
  dateLong: string;
  locationName: string | null;
  salesActive: boolean;
  tandas: { id: string; name: string; state: TandaState }[];
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
      .select('id, name, quantity_sold, quantity_total, sold_out_override')
      .eq('event_id', event.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .retry(false);

    return {
      title: event.title,
      ...describeDate(event.date_start),
      locationName: event.location_name,
      salesActive: event.sales_active,
      tandas: (tiers ?? []).map((t) => ({ id: t.id, name: t.name, state: tandaState(t) })),
    };
  } catch {
    return fallback;
  }
}
