'use server';

// Comunicación del evento: la encuesta del día después.
// Ver docs/LOGICA_DE_NEGOCIO.md → "Comunicación".
import { redirect } from 'next/navigation';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { sendEventComms, type CommsKind } from '@/lib/mail/event-mails';
import { createAdminClient } from '@/lib/supabase/admin';

// Tiempo para mandar en un clic (la página exporta maxDuration = 60). Si no alcanza, el
// resto sale con el próximo clic, sin repetir a nadie.
const BUDGET_MS = 45_000;

// mode=pending: a quien todavía no lo recibió.
// mode=all: a todos de nuevo. `since` marca cuándo empezó el reenvío, así si hay que
// seguir en otro clic no se le repite a quien ya le llegó en este reenvío.
export async function sendCommsAction(eventId: string, kind: CommsKind, formData: FormData): Promise<void> {
  const admin = await requireOwner();
  // Solo con la fiesta terminada (el botón no se muestra antes; la acción se puede llamar directo).
  const { data: event } = await createAdminClient().from('events').select('date_end').eq('id', eventId).maybeSingle();
  if (!event || new Date(event.date_end) >= new Date()) redirect(`/admin/events/${eventId}#comunicacion`);
  const resendAll = formData.get('mode') === 'all';
  const sinceRaw = String(formData.get('since') ?? '');
  const since = resendAll ? (Number.isNaN(Date.parse(sinceRaw)) ? new Date().toISOString() : sinceRaw) : null;

  const r = await sendEventComms(eventId, kind, { budgetMs: BUDGET_MS, since });
  await logAdminAction(admin.id, 'send_survey', 'event', eventId, {
    ...r,
    resend_all: resendAll,
  });

  // `t` cambia en cada envío: sin eso, el botón de confirmar queda en "Sí, mandar" al volver
  // y otro clic reenvía (ver CommsCard).
  const q = new URLSearchParams({
    envio: kind,
    ok: String(r.sent),
    fallaron: String(r.failed),
    quedan: String(r.left),
    t: String(Date.now()),
  });
  if (r.skipped > 0) q.set('salteados', String(r.skipped));
  if (since && r.left > 0) q.set('desde', since);
  redirect(`/admin/events/${eventId}?${q}#comunicacion`);
}
