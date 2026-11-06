'use server';

// Puerta en dos pasos (ver docs/LOGICA_DE_NEGOCIO.md → "Puerta"):
//   inspect → muestra los datos, no cambia nada
//   confirm → el portero vio la cédula y coincide: marca la entrada como usada (atómico)
//   reject  → no coincide: queda registrado, la entrada sigue válida
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { logAdminAction, requireAdmin, requireOwner } from '@/lib/auth/admin';
import { doorCounts } from '@/lib/door';
import { entryTime } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, normalizeDocument, tokenFromScan } from '@/lib/tickets';
import type { TicketStatus } from '@/types/database';

// 'error': no se pudo consultar la base (caída, timeout). No dice nada de la entrada.
export type ScanResult =
  | 'valid'
  | 'admitted'
  | 'already_used'
  | 'invalid'
  | 'is_bar' // un QR de un trago de barra, no una entrada
  | 'wrong_event'
  | 'not_paid'
  | 'door_closed'
  | 'not_found'
  | 'session_expired'
  | 'error';

export type ScanOutcome = {
  result: ScanResult;
  token?: string;
  ticketId?: string | null;
  name?: string | null;
  document?: string | null;
  tier?: string | null;
  invitation?: boolean;
  usedAt?: string | null;
  // Con 'not_paid': el estado real (review, pending, cancelled o refunded).
  status?: TicketStatus | null;
  // Tanda de ingreso temprano ("00:30") y si llegó después: solo avisa, decide el portero.
  entryUntil?: string | null;
  late?: boolean;
  inside: number;
  total: number;
};

// inspect_ticket (0014) suma entry_until y late; check_in_ticket no los devuelve.
type TicketRow = {
  result: string;
  ticket_id: string | null;
  buyer_name: string | null;
  buyer_document: string | null;
  tier_name: string | null;
  source: string | null;
  used_at: string | null;
  entry_until?: string | null;
  late?: boolean;
};

const device = () => headers().get('user-agent')?.slice(0, 200) ?? undefined;
const failed = (): ScanOutcome => ({ result: 'error', inside: 0, total: 0 });

// Las dos funciones devuelven siempre una fila. Sin fila (o con error) falló la consulta:
// eso es 'error', nunca 'invalid', para no rechazar una entrada buena por un corte.
async function toOutcome(eventId: string, token: string, data: unknown, error: unknown): Promise<ScanOutcome> {
  const row = (Array.isArray(data) ? data[0] : null) as TicketRow | null;
  if (error || typeof row?.result !== 'string') return failed();

  let status: TicketStatus | null = null;
  if (row.result === 'not_paid') {
    const { data: ticket } = await createAdminClient()
      .from('tickets')
      .select('status')
      .eq('qr_token', token)
      .maybeSingle();
    status = ticket?.status ?? null;
  }

  return {
    result: row.result as ScanResult,
    token,
    ticketId: row.ticket_id,
    name: row.buyer_name,
    document: row.buyer_document ? formatDocument(row.buyer_document) : null,
    tier: row.tier_name,
    invitation: row.source === 'invitation',
    usedAt: row.used_at,
    status,
    entryUntil: entryTime(row.entry_until),
    late: !!row.late,
    ...(await doorCounts(eventId)),
  };
}

async function inspect(eventId: string, token: string, adminId: string): Promise<ScanOutcome> {
  const { data, error } = await createAdminClient().rpc('inspect_ticket', {
    p_token: token,
    p_event_id: eventId,
    p_admin_id: adminId,
    p_device: device(),
  });
  return toOutcome(eventId, token, data, error);
}

// Paso 1 con QR.
export async function inspectAction(eventId: string, scanned: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };
  // El QR de un trago (/barra/qr/<token>) no es una entrada: se avisa qué es, sin registrarlo
  // como QR inválido.
  if (/\/barra\/qr\//.test(scanned)) return { result: 'is_bar', inside: 0, total: 0 };
  return inspect(eventId, tokenFromScan(scanned), admin.id);
}

// Paso 1 sin QR (plan B): se busca la entrada por cédula y sigue el mismo camino. Puede haber
// varias con la misma cédula (una viva y otras anuladas): va primero la válida o ya usada y,
// si no hay, la más nueva.
export async function inspectByDocumentAction(eventId: string, rawDocument: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };

  const db = createAdminClient();
  const document = normalizeDocument(rawDocument);
  const newest = (statuses: TicketStatus[] | null) => {
    let query = db.from('tickets').select('qr_token').eq('event_id', eventId).eq('buyer_document', document);
    if (statuses) query = query.in('status', statuses);
    return query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  };

  const valid = await newest(['paid', 'used']);
  if (valid.error) return failed();
  let ticket = valid.data;
  if (!ticket) {
    const latest = await newest(null);
    if (latest.error) return failed();
    ticket = latest.data;
  }

  if (!ticket?.qr_token) return { result: 'not_found', ...(await doorCounts(eventId)) };
  return inspect(eventId, ticket.qr_token, admin.id);
}

// Paso 2a: la cédula coincide → entra. check_in_ticket garantiza un solo uso aunque dos
// porteros confirmen la misma entrada a la vez (al segundo le da 'already_used').
export async function confirmAction(eventId: string, token: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };

  const { data, error } = await createAdminClient().rpc('check_in_ticket', {
    p_token: token,
    p_event_id: eventId,
    p_admin_id: admin.id,
    p_device: device(),
  });
  return toOutcome(eventId, token, data, error);
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
export async function toggleDoorAction(eventId: string, closed: boolean): Promise<{ ok: boolean }> {
  const admin = await requireOwner();
  const db = createAdminClient();
  const { error } = await db.from('events').update({ door_closed: !closed }).eq('id', eventId);
  if (error) return { ok: false };
  await logAdminAction(admin.id, closed ? 'open_door' : 'close_door', 'event', eventId);
  revalidatePath(`/admin/scan/${eventId}`);
  return { ok: true };
}
