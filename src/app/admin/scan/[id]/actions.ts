'use server';

// Puerta en dos pasos (ver docs/LOGICA_DE_NEGOCIO.md → "Puerta"):
//   inspect → muestra los datos, no cambia nada
//   confirm → el portero vio la cédula y coincide: marca la entrada como usada (atómico)
//   reject  → no coincide: queda registrado, la entrada sigue válida
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { logAdminAction, requireAdmin, requireOwner } from '@/lib/auth/admin';
import { doorCounts } from '@/lib/door';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, normalizeDocument, tokenFromScan } from '@/lib/tickets';

export type ScanResult =
  | 'valid'
  | 'admitted'
  | 'already_used'
  | 'invalid'
  | 'wrong_event'
  | 'not_paid'
  | 'door_closed'
  | 'not_found'
  | 'session_expired';

export type ScanOutcome = {
  result: ScanResult;
  token?: string;
  ticketId?: string | null;
  name?: string | null;
  document?: string | null;
  tier?: string | null;
  invitation?: boolean;
  usedAt?: string | null;
  inside: number;
  total: number;
};

type TicketRow = {
  result: string;
  ticket_id: string | null;
  buyer_name: string | null;
  buyer_document: string | null;
  tier_name: string | null;
  source: string | null;
  used_at: string | null;
};

const device = () => headers().get('user-agent')?.slice(0, 200) ?? undefined;

async function toOutcome(eventId: string, token: string, row: TicketRow | null): Promise<ScanOutcome> {
  const counts = await doorCounts(eventId);
  if (!row) return { result: 'invalid', ...counts };
  return {
    result: row.result as ScanResult,
    token,
    ticketId: row.ticket_id,
    name: row.buyer_name,
    document: row.buyer_document ? formatDocument(row.buyer_document) : null,
    tier: row.tier_name,
    invitation: row.source === 'invitation',
    usedAt: row.used_at,
    ...counts,
  };
}

async function inspect(eventId: string, token: string, adminId: string): Promise<ScanOutcome> {
  const db = createAdminClient();
  const { data } = await db.rpc('inspect_ticket', {
    p_token: token,
    p_event_id: eventId,
    p_admin_id: adminId,
    p_device: device(),
  });
  return toOutcome(eventId, token, (Array.isArray(data) ? data[0] : null) as TicketRow | null);
}

// Paso 1 con QR.
export async function inspectAction(eventId: string, scanned: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };
  return inspect(eventId, tokenFromScan(scanned), admin.id);
}

// Paso 1 sin QR (plan B): se busca la entrada por cédula y sigue el mismo camino.
export async function inspectByDocumentAction(eventId: string, rawDocument: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };

  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('qr_token')
    .eq('event_id', eventId)
    .eq('buyer_document', normalizeDocument(rawDocument))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ticket?.qr_token) return { result: 'not_found', ...(await doorCounts(eventId)) };
  return inspect(eventId, ticket.qr_token, admin.id);
}

// Paso 2a: la cédula coincide → entra. check_in_ticket garantiza un solo uso aunque dos
// porteros confirmen la misma entrada a la vez (al segundo le da 'already_used').
export async function confirmAction(eventId: string, token: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };

  const db = createAdminClient();
  const { data } = await db.rpc('check_in_ticket', {
    p_token: token,
    p_event_id: eventId,
    p_admin_id: admin.id,
    p_device: device(),
  });
  return toOutcome(eventId, token, (Array.isArray(data) ? data[0] : null) as TicketRow | null);
}

// Paso 2b: la cédula no coincide (o el portero cancela) → solo se registra.
export async function rejectAction(eventId: string, ticketId: string): Promise<void> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return;
  const db = createAdminClient();
  await db.rpc('reject_check_in', {
    p_ticket_id: ticketId,
    p_event_id: eventId,
    p_admin_id: admin.id,
    p_device: device(),
  });
}

// "Cerrar puerta": desde ahí todo escaneo se rechaza. Solo owners.
export async function toggleDoorAction(eventId: string, closed: boolean): Promise<void> {
  const admin = await requireOwner();
  const db = createAdminClient();
  await db.from('events').update({ door_closed: !closed }).eq('id', eventId);
  await logAdminAction(admin.id, closed ? 'open_door' : 'close_door', 'event', eventId);
  revalidatePath(`/admin/scan/${eventId}`);
}
