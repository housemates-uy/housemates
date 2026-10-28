'use server';

// Guarda la respuesta de la encuesta del día después. Una por entrada: si la persona
// vuelve a entrar al link y responde de nuevo, se pisa la anterior.
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const TOKEN_RE = /^[A-Za-z0-9_-]{10,64}$/;

const surveySchema = z.object({
  rating: z.coerce
    .number({ invalid_type_error: 'Elegí un puntaje del 1 al 5.' })
    .int()
    .min(1, 'Elegí un puntaje del 1 al 5.')
    .max(5, 'Elegí un puntaje del 1 al 5.'),
  improve: z.string().trim().max(1000, 'Escribí hasta 1000 caracteres.').optional(),
  would_return: z.enum(['si', 'no'], { errorMap: () => ({ message: 'Contanos si volverías.' }) }),
});

export type SurveyResult = { ok: true } | { error: string; field?: string };

export async function submitSurveyAction(token: string, formData: FormData): Promise<SurveyResult> {
  if (!TOKEN_RE.test(token)) return { error: 'Este link no es válido.' };

  const parsed = surveySchema.safeParse({
    rating: formData.get('rating') ?? undefined,
    improve: formData.get('improve') ?? undefined,
    would_return: formData.get('would_return') ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }

  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('id, event_id, status')
    .eq('qr_token', token)
    .maybeSingle();
  if (!ticket || ticket.status !== 'used') return { error: 'Esta encuesta es para quienes vinieron a la fiesta.' };

  const { error } = await db.from('event_feedback').upsert(
    {
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      rating: parsed.data.rating,
      improve: parsed.data.improve || null,
      would_return: parsed.data.would_return === 'si',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'ticket_id' },
  );
  if (error) return { error: 'No se pudo guardar tu respuesta. Probá de nuevo en un rato.' };
  return { ok: true };
}
