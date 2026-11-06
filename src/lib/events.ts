import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { TierInput } from '@/lib/validation/schemas';

export const TZ = 'America/Montevideo';

export function toUTC(localDatetime: string): string {
  return fromZonedTime(new Date(localDatetime), TZ).toISOString();
}

export function toLocalInput(iso: string): string {
  return format(toZonedTime(new Date(iso), TZ), "yyyy-MM-dd'T'HH:mm");
}

export function formatLocal(iso: string, pattern: string): string {
  return format(toZonedTime(new Date(iso), TZ), pattern, { locale: es });
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

export const emptyTier = (): TierInput => ({
  name: '',
  price_uyu: 0,
  quantity_total: 0,
  description: '',
  entry_until: '',
  sales_start: '',
  presale_code: '',
});

// Campos de ingreso temprano, salida a la venta y preventa, del formulario a la base.
export function tierExtrasToDb(t: Pick<TierInput, 'entry_until' | 'sales_start' | 'presale_code'>) {
  return {
    entry_until: t.entry_until || null,
    sales_start: t.sales_start ? toUTC(t.sales_start) : null,
    presale_code: t.presale_code || null,
  };
}

// La base devuelve la hora como "00:30:00"; se muestra "00:30".
export function entryTime(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null;
}

export function formatUYU(amount: number) {
  return `$${amount.toLocaleString('es-UY')}`;
}

// Por qué un evento no se puede eliminar (event_delete_blocker, migración 0025).
export const EVENT_DELETE_BLOCKERS: Record<string, string> = {
  has_tickets: 'Tiene entradas',
  has_bar_orders: 'Tiene pedidos de barra',
  has_scans: 'Tiene escaneos en la puerta o la barra',
};
