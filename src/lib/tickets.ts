// ============================================================
// Entradas: reglas de negocio compartidas por el admin, la compra web y la puerta.
// La explicación completa del flujo está en docs/LOGICA_DE_NEGOCIO.md.
// ============================================================
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, isValidEmail } from '@/lib/validation/email';
import { validateCI } from '@/lib/validation/document';
import type { TicketSource, TicketStatus } from '@/types/database';

// ---------- Token del QR ----------
// 128 bits aleatorios en base64url (22 caracteres). No lleva datos ni firma: es una
// clave opaca que solo sirve si existe en la tabla `tickets`. Adivinarla es inviable,
// y copiar un QR ajeno no sirve porque se usa una sola vez en puerta.
export function generateQrToken(): string {
  return randomBytes(16).toString('base64url');
}

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
// La CI se guarda solo con dígitos y con 8 cifras (relleno con 0), así "1.234.567-8"
// y "12345678" son la misma persona para la regla de una entrada por CI.
export function normalizeDocument(raw: string): string {
  return raw.replace(/\D/g, '').padStart(8, '0');
}

export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase();
}

export const buyerSchema = z.object({
  name: z.string().trim().min(3, 'Poné nombre y apellido'),
  email: z.string().trim().refine(isValidEmail, 'Email inválido'),
  document: z.string().trim().refine(validateCI, 'Cédula uruguaya inválida'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  instagram: z
    .string()
    .trim()
    .transform(normalizeInstagram)
    .refine((v) => /^[a-z0-9._]{1,30}$/.test(v), 'Usuario de Instagram inválido'),
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
};

export async function createTicket(params: {
  eventId: string;
  tierId: string | null;
  source: TicketSource;
  status: Extract<TicketStatus, 'pending' | 'paid'>;
  buyer: z.output<typeof buyerSchema>;
  amount: number;
  holdMinutes?: number;
  adminId?: string | null;
  notes?: string | null;
}): Promise<{ id: string; qrToken: string } | { error: string }> {
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
    p_instagram: params.buyer.instagram,
    p_amount: params.amount,
    p_qr_token: qrToken,
    p_hold_minutes: params.holdMinutes,
    p_admin_id: params.adminId ?? undefined,
    p_notes: params.notes ?? undefined,
  });

  if (error) {
    const known = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
    return { error: known ? ERROR_MESSAGES[known] : 'No se pudo crear la entrada. Probá de nuevo.' };
  }
  return { id: data as string, qrToken };
}

// ---------- Textos para mostrar ----------
export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: 'Pago pendiente',
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
