// ============================================================
// Comprobantes de transferencia. Ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
// ============================================================
// Se guardan en el bucket privado `comprobantes` de Supabase Storage. Nunca son públicos:
// el admin los ve con un link temporal. Límite de 4 MB porque Vercel no acepta pedidos más
// grandes; el formulario achica las fotos grandes antes de mandarlas.
import { createAdminClient } from '@/lib/supabase/admin';

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

// Link temporal para que un admin vea el comprobante (10 minutos).
export async function receiptSignedUrl(path: string): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// El archivo, para adjuntarlo al mail que avisa a los owners.
export async function downloadReceipt(path: string): Promise<{ content: Buffer; filename: string } | null> {
  const { data } = await createAdminClient().storage.from(RECEIPT_BUCKET).download(path);
  if (!data) return null;
  return { content: Buffer.from(await data.arrayBuffer()), filename: `comprobante.${path.split('.').pop()}` };
}
