import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { SurveyForm } from './survey-form';

export const metadata: Metadata = { title: 'Encuesta', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Encuesta del día después: /encuesta/<qr_token>. Le llega por mail a quien entró a la
// fiesta (entrada `used`). El link es el mismo token del QR, que después de usado en
// puerta ya no sirve para entrar.
// Token inexistente: muestra la página 404. El status HTTP sale 200 porque el loading.tsx
// de la raíz ya empezó a mandar la página (igual que /ticket/<token>).
export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { puntaje?: string };
}) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(params.token)) notFound();

  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('id, buyer_name, status, event_id')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: event }, { data: feedback }] = await Promise.all([
    db.from('events').select('title, date_start').eq('id', ticket.event_id).single(),
    db.from('event_feedback').select('rating, improve, would_return').eq('ticket_id', ticket.id).maybeSingle(),
  ]);
  if (!event) notFound();

  const firstName = ticket.buyer_name.split(' ')[0];
  // El puntaje que tocó en el mail gana sobre una respuesta anterior.
  const fromMail = Number(searchParams.puntaje);
  const rating = Number.isInteger(fromMail) && fromMail >= 1 && fromMail <= 5 ? fromMail : (feedback?.rating ?? null);

  return (
    <main id="contenido" className="relative isolate min-h-[100dvh] overflow-hidden">
      <DoodleBackdrop className="-z-10" />

      <div className="mx-auto max-w-md px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <Logo className="mx-auto h-16" />

        <header className="mt-12">
          <p className="text-sm text-bone/70 first-letter:uppercase">
            {event.title}, {formatLocal(event.date_start, "EEEE d 'de' MMMM")}
          </p>
          <h1 className="mt-3 text-[2.75rem] font-bold leading-[0.95] tracking-[-0.045em]">
            {ticket.status === 'used' ? `¿Cómo la pasaste, ${firstName}?` : 'Encuesta'}
          </h1>
          <span aria-hidden className="mt-6 block h-px w-16 bg-violet" />
        </header>

        {ticket.status === 'used' ? (
          <>
            <p className="mt-6 text-bone/75">Son tres preguntas y te lleva un minuto. Lo leemos todo.</p>
            <SurveyForm
              token={params.token}
              firstName={firstName}
              answered={!!feedback}
              initial={{
                rating,
                improve: feedback?.improve ?? '',
                wouldReturn: feedback ? (feedback.would_return ? 'si' : 'no') : null,
              }}
            />
          </>
        ) : (
          <p className="mt-6 text-bone/75">
            Esta encuesta es para quienes vinieron a la fiesta. Se habilita cuando entrás con tu QR en puerta.
          </p>
        )}
      </div>
    </main>
  );
}
