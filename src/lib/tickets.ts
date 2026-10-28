// ============================================================
// Entradas: reglas de negocio compartidas por el admin, la compra web y la puerta.
// La explicación completa del flujo está en docs/LOGICA_DE_NEGOCIO.md.
// ============================================================
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, isValidEmail } from '@/lib/validation/email';
import { normalizeDocument, validateCI } from '@/lib/validation/document';
import type { PaymentMethod, TicketSource, TicketStatus } from '@/types/database';

// ---------- Token del QR ----------
// 128 bits aleatorios en base64url (22 caracteres). No lleva datos ni firma: es una
// clave opaca que solo sirve si existe en la tabla `tickets`. Adivinarla es inviable,
// y copiar un QR ajeno no sirve porque se usa una sola vez en puerta.
export function generateQrToken(): string {
  return randomBytes(16).toString('base64url');
}

// Cookie con la última compra de este navegador: /compra/resultado muestra el link de la
// entrada solo a quien la compró (el id de la entrada o el payment_id no alcanzan).
export const PURCHASE_COOKIE = 'hm_compra';

// URL pública del sitio, para armar el link de cada entrada.
// En Vercel se toma del dominio de producción; en local, localhost.
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}

// El QR codifica la URL de la entrada (no solo el token): si alguien lo escanea con la
// cámara del celular, abre su entrada. El scanner de puerta extrae el token de la URL.
export function ticketUrl(token: string): string {
  return `${appUrl()}/ticket/${token}`;
}

export function tokenFromScan(scanned: string): string {
  const match = scanned.trim().match(/\/ticket\/([A-Za-z0-9_-]{10,64})/);
  return match ? match[1] : scanned.trim();
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

// ---------- Datos del comprador ----------
export { normalizeDocument };

export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase();
}

export const buyerSchema = z.object({
  name: z.string().trim().min(3, 'Poné nombre y apellido').max(100, 'El nombre es demasiado largo'),
  email: z.string().trim().refine(isValidEmail, 'Email inválido'),
  document: z.string().trim().refine(validateCI, 'Cédula uruguaya inválida'),
  phone: z.string().trim().max(30, 'El celular es demasiado largo (hasta 30 caracteres)').optional().or(z.literal('')),
  // Opcional: la compra web ya no lo pide; el admin puede anotarlo en las entradas manuales.
  instagram: z
    .string()
    .nullish()
    .transform((v) => (v ? normalizeInstagram(v) : ''))
    .refine((v) => v === '' || /^[a-z0-9._]{1,30}$/.test(v), 'Usuario de Instagram inválido'),
});
export type BuyerInput = z.input<typeof buyerSchema>;

// ---------- Crear entrada ----------
// Toda entrada nace por acá: manual (transferencia), invitación o compra web.
// La lógica atómica (stock, una por persona) la hace la función `create_ticket` en Postgres.
const ERROR_MESSAGES: Record<string, string> = {
  sold_out: 'No quedan lugares en esa tanda.',
  tier_inactive: 'Esa tanda no está disponible.',
  duplicate_email: 'Ya hay una entrada para este evento con ese email.',
  duplicate_document: 'Ya hay una entrada para este evento con esa cédula.',
  discount_invalid: 'Ese código de descuento ya no es válido.',
  discount_exhausted: 'Ese código de descuento ya no tiene usos disponibles.',
  presale_required: 'Esa tanda es de preventa: entrá con el link que te mandamos.',
  tier_not_started: 'Esa tanda todavía no salió a la venta.',
};

export async function createTicket(params: {
  eventId: string;
  tierId: string | null;
  source: TicketSource;
  status: Extract<TicketStatus, 'pending' | 'review' | 'paid'>;
  buyer: z.output<typeof buyerSchema>;
  amount: number;
  holdMinutes?: number;
  adminId?: string | null;
  notes?: string | null;
  paymentMethod?: PaymentMethod;
  discountCodeId?: string | null;
  discountUyu?: number;
  // Tandas de preventa: create_ticket lo compara con el de la tanda (solo compra web).
  presaleCode?: string | null;
}): Promise<{ id: string; qrToken: string } | { error: string; code?: string }> {
  const db = createAdminClient();
  const qrToken = generateQrToken();
  const { data, error } = await db.rpc('create_ticket', {
    p_event_id: params.eventId,
    p_tier_id: params.tierId as string,
    p_source: params.source,
    p_status: params.status,
    p_name: params.buyer.name,
    p_email: params.buyer.email.toLowerCase(),
    p_email_norm: normalizeEmail(params.buyer.email),
    p_document: normalizeDocument(params.buyer.document),
    p_phone: params.buyer.phone || (null as unknown as string),
    p_instagram: params.buyer.instagram || (null as unknown as string),
    p_amount: params.amount,
    p_qr_token: qrToken,
    p_hold_minutes: params.holdMinutes,
    p_admin_id: params.adminId ?? undefined,
    p_notes: params.notes ?? undefined,
    p_payment_method: params.paymentMethod,
    p_discount_code_id: params.discountCodeId ?? undefined,
    p_discount_uyu: params.discountUyu ?? 0,
    p_presale_code: params.presaleCode ?? undefined,
  });

  if (error) {
    const known = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
    return {
      error: known ? ERROR_MESSAGES[known] : 'No se pudo crear la entrada. Probá de nuevo.',
      code: known,
    };
  }
  return { id: data as string, qrToken };
}

// ---------- Compra de varias entradas (§5.2e) ----------
// La de quien compra primero y después las de sus amigos, cada una con sus datos. Todo o
// nada en una transacción (create_order): si una falla no queda ninguna. `person` dice de
// quién es el problema (1 = quien compra).
export type OrderPerson = {
  buyer: z.output<typeof buyerSchema>;
  amount: number;
  discountUyu: number;
  transport: { id: string; price: number } | null;
};

export async function createOrder(params: {
  eventId: string;
  tierId: string;
  paymentMethod: PaymentMethod;
  holdMinutes: number;
  discountCodeId: string | null;
  presaleCode: string | null;
  people: OrderPerson[];
}): Promise<{ ids: string[] } | { error: string; code?: string; person?: number }> {
  const { data, error } = await createAdminClient().rpc('create_order', {
    p_event_id: params.eventId,
    p_tier_id: params.tierId,
    p_payment_method: params.paymentMethod,
    p_hold_minutes: params.holdMinutes,
    p_discount_code_id: params.discountCodeId,
    p_presale_code: params.presaleCode,
    p_people: params.people.map((p) => ({
      name: p.buyer.name,
      email: p.buyer.email.toLowerCase(),
      email_norm: normalizeEmail(p.buyer.email),
      document: normalizeDocument(p.buyer.document),
      phone: p.buyer.phone || '',
      qr_token: generateQrToken(),
      amount: p.amount,
      discount_uyu: p.discountUyu,
      transport_option_id: p.transport?.id ?? null,
      transport_price: p.transport?.price ?? null,
    })),
  });
  if (error) {
    const match = error.message.match(/([a-z_]+)#(\d+)/);
    const code = match?.[1];
    return {
      error: (code && ERROR_MESSAGES[code]) || 'No se pudo crear la compra. Probá de nuevo.',
      code,
      person: match ? Number(match[2]) : undefined,
    };
  }
  return { ids: data as string[] };
}

// ---------- Textos para mostrar ----------
export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: 'Pago pendiente',
  review: 'Transferencia a validar',
  paid: 'Válida',
  used: 'Usada',
  cancelled: 'Anulada',
  refunded: 'Reembolsada',
};

export const SOURCE_LABELS: Record<TicketSource, string> = {
  purchase: 'Compra web',
  manual: 'Venta manual',
  invitation: 'Invitación',
};

export function formatDocument(doc: string): string {
  const d = normalizeDocument(doc);
  return `${d[0]}.${d.slice(1, 4)}.${d.slice(4, 7)}-${d[7]}`;
}

// Celular agrupado con espacios ("099 123 456", "+598 99 123 456"). En los CSV hace falta:
// Excel abre "099123456" como número y se come el 0. Lo que no es solo dígitos queda igual.
export function formatPhone(raw: string): string {
  const value = raw.trim();
  if (!/^\+?\d+$/.test(value)) return value;
  const d = value.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('598')) return `+598 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (d.length === 8) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${value.startsWith('+') ? '+' : ''}${d.match(/\d{1,3}/g)!.join(' ')}`;
}
