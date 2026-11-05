// ============================================================
// Comprobantes de transferencia. Ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
// ============================================================
// Se guardan en el bucket privado `comprobantes` de Supabase Storage. Nunca son públicos:
// el admin los ve con un link temporal. Límite de 4 MB porque Vercel no acepta pedidos más
// grandes; el formulario achica las fotos grandes antes de mandarlas.
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

export const RECEIPT_BUCKET = 'comprobantes';
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};
export const RECEIPT_ACCEPT = Object.keys(TYPES).join(',');

export function validateReceipt(file: unknown): { file: File } | { error: string } {
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Adjuntá el comprobante de la transferencia.' };
  }
  if (!TYPES[file.type]) return { error: 'El comprobante tiene que ser una foto o un PDF.' };
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: 'El comprobante pesa más de 4 MB. Mandá una captura de pantalla o un PDF más liviano.' };
  }
  return { file };
}

export async function uploadReceipt(eventId: string, ticketId: string, file: File): Promise<string | null> {
  const path = `${eventId}/${ticketId}.${TYPES[file.type]}`;
  const { error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  return error ? null : path;
}

// Link temporal para que un owner vea el comprobante (10 minutos, salvo que se pida menos).
export async function receiptSignedUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(RECEIPT_BUCKET).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

// Comprobante de devolución (§5.4, migración 0030): una entrada válida cobrada por
// transferencia (compra web o manual) y de más de $0 no se anula sin él. La misma regla está
// en cancel_ticket, que devuelve 'refund_receipt_required' si falta.
type TicketRow = Database['public']['Tables']['tickets']['Row'];

export function needsRefundReceipt(
  t: Pick<TicketRow, 'status' | 'source' | 'payment_method' | 'amount_paid_uyu'>,
): boolean {
  return (
    t.status === 'paid' &&
    Number(t.amount_paid_uyu) > 0 &&
    (t.source === 'manual' || t.payment_method === 'transfer')
  );
}

// El tipo se saca de los primeros bytes, no de lo que dice el navegador.
function refundReceiptType(bytes: Uint8Array): { ext: string; mime: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(bytes.slice(from, to)));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (ascii(0, 5) === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  return null;
}

export async function uploadRefundReceipt(
  ticketId: string,
  file: unknown,
): Promise<{ path: string; kind: string } | { error: string }> {
  if (!(file instanceof Blob) || file.size === 0) {
    return { error: 'Subí el comprobante de la devolución para anularla.' };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: 'El comprobante pesa más de 4 MB. Subí una captura o un PDF más liviano.' };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = refundReceiptType(bytes);
  if (!type) return { error: 'El comprobante tiene que ser una foto JPG, PNG o WebP, o un PDF.' };
  const path = `devoluciones/${ticketId}/${randomBytes(4).toString('hex')}.${type.ext}`;
  const { error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType: type.mime, upsert: false });
  if (error) return { error: 'No se pudo subir el comprobante. Probá de nuevo: la entrada sigue válida.' };
  return { path, kind: type.ext.toUpperCase() };
}

// Si la entrada no se llegó a anular, el comprobante subido no queda suelto en el bucket.
export async function removeRefundReceipt(path: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(RECEIPT_BUCKET).remove([path]);
  if (error) console.error('[devolución] no se pudo borrar el comprobante', path, error.message);
}

// El archivo, para adjuntarlo al mail que avisa a los owners.
export async function downloadReceipt(path: string): Promise<{ content: Buffer; filename: string } | null> {
  const { data } = await createAdminClient().storage.from(RECEIPT_BUCKET).download(path);
  if (!data) return null;
  return { content: Buffer.from(await data.arrayBuffer()), filename: `comprobante.${path.split('.').pop()}` };
}
