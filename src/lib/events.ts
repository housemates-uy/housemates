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
});

export function formatUYU(amount: number) {
  return `$${amount.toLocaleString('es-UY')}`;
}
