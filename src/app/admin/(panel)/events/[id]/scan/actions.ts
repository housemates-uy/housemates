'use server';

// Check-in en puerta. La validación real (un solo uso, evento correcto, pagada, puerta
// cerrada) la hace la función check_in_ticket en Postgres de forma atómica.
// Ver docs/LOGICA_DE_NEGOCIO.md → "Puerta".
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { logAdminAction, requireAdmin, requireOwner } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, normalizeDocument, tokenFromScan } from '@/lib/tickets';
import type { CheckinResult } from '@/types/database';

export type ScanOutcome = {
  result: CheckinResult | 'session_expired' | 'not_found';
  name?: string | null;
  document?: string | null;
  tier?: string | null;
  invitation?: boolean;
  usedAt?: string | null;
  inside: number;
  total: number;
};

async function doorCounts(eventId: string) {
  const db = createAdminClient();
  const [{ count: inside }, { count: total }] = await Promise.all([
    db.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'used'),
    db
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['paid', 'used']),
  ]);
  return { inside: inside ?? 0, total: total ?? 0 };
}

async function runCheckIn(eventId: string, token: string, adminId: string): Promise<ScanOutcome> {
  const db = createAdminClient();
  const device = headers().get('user-agent')?.slice(0, 200) ?? null;
  const { data, error } = await db.rpc('check_in_ticket', {
    p_token: token,
    p_event_id: eventId,
    p_admin_id: adminId,
    p_device: device ?? undefined,
  });
  const row = Array.isArray(data) ? data[0] : null;
  const counts = await doorCounts(eventId);
  if (error || !row) return { result: 'invalid', ...counts };
  return {
    result: row.result,
    name: row.buyer_name,
    document: row.buyer_document ? formatDocument(row.buyer_document) : null,
    tier: row.tier_name,
    invitation: row.source === 'invitation',
    usedAt: row.used_at,
    ...counts,
  };
}

export async function scanAction(eventId: string, scanned: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };
  return runCheckIn(eventId, tokenFromScan(scanned), admin.id);
}

// Plan B si el QR no se puede leer (pantalla rota, sin batería): se busca por cédula.
// Hace el mismo check-in que el QR, así queda registrado y respeta el uso único.
export async function checkInByDocumentAction(eventId: string, rawDocument: string): Promise<ScanOutcome> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { result: 'session_expired', inside: 0, total: 0 };

  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('qr_token')
    .eq('event_id', eventId)
    .eq('buyer_document', normalizeDocument(rawDocument))
    .in('status', ['paid', 'used', 'pending', 'cancelled', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ticket?.qr_token) return { result: 'not_found', ...(await doorCounts(eventId)) };
  return runCheckIn(eventId, ticket.qr_token, admin.id);
}

// "Cerrar puerta": a partir de ahí todo escaneo se rechaza (door_closed). Solo owners.
export async function toggleDoorAction(eventId: string, closed: boolean): Promise<void> {
  const admin = await requireOwner();
  const db = createAdminClient();
  await db.from('events').update({ door_closed: !closed }).eq('id', eventId);
  await logAdminAction(admin.id, closed ? 'open_door' : 'close_door', 'event', eventId);
  revalidatePath(`/admin/events/${eventId}/scan`);
}
