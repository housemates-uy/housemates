import { ConfirmSubmitButton, SubmitButton } from '@/components/admin/submit-button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { formatLocal } from '@/lib/events';
import { commsAudience, type CommsKind } from '@/lib/mail/event-mails';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveArrivalInfoAction, sendCommsAction } from './comms-actions';

type Audience = Awaited<ReturnType<typeof commsAudience>>;
type SearchParams = Record<string, string | undefined>;

const KIND_COPY: Record<CommsKind, { title: string; description: string; action: string; empty: string }> = {
  reminder: {
    title: 'Recordatorio "Antes de ir"',
    description: 'Fecha, lugar, cómo llegar, qué llevar, las reglas y su QR. A las entradas válidas.',
    action: 'Mandar recordatorio',
    empty: 'No hay entradas válidas.',
  },
  survey: {
    title: 'Encuesta del día después',
    description: 'Puntaje del 1 al 5, qué mejorarían y si volverían. A quienes entraron.',
    action: 'Mandar encuesta',
    empty: 'Todavía no entró nadie.',
  },
};

// Sección "Comunicación" del resumen del evento. Mandar: solo owners.
export async function CommsSection({
  eventId,
  arrivalInfo,
  isOwner,
  searchParams,
}: {
  eventId: string;
  arrivalInfo: string | null;
  isOwner: boolean;
  searchParams: SearchParams;
}) {
  const [reminder, survey] = await Promise.all([
    commsAudience(eventId, 'reminder'),
    commsAudience(eventId, 'survey'),
  ]);

  return (
    <section id="comunicacion" aria-labelledby="comunicacion-titulo" className="scroll-mt-6 space-y-4 border-t border-bone/10 pt-8">
      <div>
        <h2 id="comunicacion-titulo" className="text-lg font-bold tracking-tight">
          Comunicación
        </h2>
        <p className="mt-1 text-sm text-bone/55">
          Mails a quienes tienen entrada. También salen solos a quien todavía no los recibió: el
          recordatorio el día antes del evento y la encuesta el día después. Gmail permite unos 500
          mails por día, contando las entradas que se venden.
        </p>
      </div>

      <SendNotice eventId={eventId} searchParams={searchParams} />

      <div className="grid gap-4 md:grid-cols-2">
        <CommsCard eventId={eventId} kind="reminder" audience={reminder} isOwner={isOwner} nonce={searchParams.t} />
        <CommsCard eventId={eventId} kind="survey" audience={survey} isOwner={isOwner} nonce={searchParams.t} />
      </div>

      <Card>
        <form action={saveArrivalInfoAction.bind(null, eventId)} className="space-y-4">
          <Field
            label="Cómo llegar (opcional)"
            hint="Va en el recordatorio, abajo del link a Google Maps. Ej: por dónde se entra, dónde estacionar, qué ómnibus te deja cerca."
          >
            <Textarea name="arrival_info" rows={4} maxLength={2000} defaultValue={arrivalInfo ?? ''} />
          </Field>
          <div className="flex items-center gap-4">
            <SubmitButton variant="outline" size="sm">
              Guardar
            </SubmitButton>
            {searchParams.llegada === 'ok' && (
              <p role="status" className="text-sm text-bone/75">
                Guardado.
              </p>
            )}
          </div>
        </form>
      </Card>

      <SurveyResults eventId={eventId} attended={survey.total} />
    </section>
  );
}

function CommsCard({
  eventId,
  kind,
  audience,
  isOwner,
  nonce,
}: {
  eventId: string;
  kind: CommsKind;
  audience: Audience;
  isOwner: boolean;
  // Cambia en cada envío (ver sendCommsAction): como key de los forms, hace que el botón de
  // confirmar vuelva a su estado inicial en vez de quedar en "Sí, mandar".
  nonce?: string;
}) {
  const copy = KIND_COPY[kind];
  const send = sendCommsAction.bind(null, eventId, kind);
  const pending = audience.pending.length;

  return (
    <Card className="flex flex-col">
      <h3 className="text-sm font-medium">{copy.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-bone/55">{copy.description}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight">
        {audience.received}{' '}
        <span className="text-sm font-normal text-bone/50">de {audience.total} lo recibieron</span>
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {!isOwner ? (
          <p className="text-xs text-bone/55">Solo los owners pueden mandar.</p>
        ) : pending > 0 ? (
          <form key={`pending-${nonce}`} action={send}>
            <input type="hidden" name="mode" value="pending" />
            <ConfirmSubmitButton variant="outline" size="sm" confirmLabel={`Sí, mandar ${pending}`}>
              {copy.action} ({pending})
            </ConfirmSubmitButton>
          </form>
        ) : (
          <p className="text-xs text-bone/55">{audience.total === 0 ? copy.empty : 'Ya lo recibieron todos.'}</p>
        )}
        {isOwner && audience.received > 0 && (
          <form key={`all-${nonce}`} action={send}>
            <input type="hidden" name="mode" value="all" />
            <ConfirmSubmitButton variant="ghost" size="sm" confirmLabel={`Sí, reenviar a ${audience.total}`}>
              Reenviar a todos
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </Card>
  );
}

// Resultado del último envío (llega por la URL desde sendCommsAction).
function SendNotice({ eventId, searchParams }: { eventId: string; searchParams: SearchParams }) {
  const kind = searchParams.envio;
  if (kind !== 'reminder' && kind !== 'survey') return null;
  const sent = Number(searchParams.ok ?? 0);
  const failed = Number(searchParams.fallaron ?? 0);
  const left = Number(searchParams.quedan ?? 0);
  const skipped = Number(searchParams.salteados ?? 0);
  const since = searchParams.desde;
  const what = kind === 'reminder' ? 'Recordatorio' : 'Encuesta';

  let message = `${what}: ${sent === 1 ? 'se mandó 1 mail' : `se mandaron ${sent} mails`}.`;
  if (sent === 0 && failed > 0) {
    message = `${what}: no salió ningún mail. Revisá la configuración del correo o si se llegó al límite diario de Gmail.`;
  } else if (failed > 0) {
    message += ` ${failed === 1 ? '1 no salió' : `${failed} no salieron`}: quedan pendientes.`;
  }
  if (skipped > 0) {
    message += ` ${skipped === 1 ? 'A 1 persona ya se lo estaba' : `A ${skipped} personas ya se lo estaba`} mandando otro envío al mismo tiempo: no se repitió.`;
  }
  if (left > 0 && sent > 0) message += ` Quedan ${left} por mandar: tocá de nuevo para seguir.`;

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-bone/15 bg-bone/[0.04] px-4 py-3 text-sm text-bone/80">
      <p>{message}</p>
      {since && left > 0 && (
        <form action={sendCommsAction.bind(null, eventId, kind)}>
          <input type="hidden" name="mode" value="all" />
          <input type="hidden" name="since" value={since} />
          <SubmitButton variant="outline" size="sm">
            Seguir reenviando ({left})
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

async function SurveyResults({ eventId, attended }: { eventId: string; attended: number }) {
  const { data } = await createAdminClient()
    .from('event_feedback')
    .select('id, rating, improve, would_return, updated_at')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  const answers = data ?? [];

  if (answers.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-medium">Resultados de la encuesta</h3>
        <p className="mt-1 text-sm text-bone/55">Todavía no respondió nadie.</p>
      </Card>
    );
  }

  const average = answers.reduce((s, a) => s + a.rating, 0) / answers.length;
  const wouldReturn = Math.round((answers.filter((a) => a.would_return).length / answers.length) * 100);
  const byRating = [5, 4, 3, 2, 1].map((n) => ({ n, count: answers.filter((a) => a.rating === n).length }));
  const max = Math.max(...byRating.map((r) => r.count));
  const comments = answers.filter((a) => a.improve);

  return (
    <Card>
      <h3 className="text-sm font-medium">Resultados de la encuesta</h3>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <dt className="text-xs text-bone/50">Promedio</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight">
            {average.toLocaleString('es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
            <span className="text-sm font-normal text-bone/50">/ 5</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-bone/50">Respondieron</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight">
            {answers.length}{' '}
            <span className="text-sm font-normal text-bone/50">de {attended}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-bone/50">Volverían</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight">{wouldReturn} %</dd>
        </div>
      </dl>

      <ul aria-label="Respuestas por puntaje" className="mt-6 space-y-1.5">
        {byRating.map(({ n, count }) => (
          <li key={n} className="grid grid-cols-[1rem_1fr_2rem] items-center gap-3 text-xs">
            <span className="font-bold text-bone/70">{n}</span>
            <span className="h-2 overflow-hidden rounded-full bg-bone/10">
              <span className="block h-full rounded-full bg-bone/70" style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
            </span>
            <span className="text-right text-bone/55">{count}</span>
          </li>
        ))}
      </ul>

      {comments.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium">Qué mejorarían ({comments.length})</h4>
          <ul className="mt-2 divide-y divide-bone/10">
            {comments.map((c) => (
              <li key={c.id} className="py-3">
                <p className="whitespace-pre-line text-sm text-bone/85">{c.improve}</p>
                <p className="mt-1 text-xs text-bone/45">
                  {c.rating}/5 · {c.would_return ? 'Volvería' : 'No volvería'} ·{' '}
                  {formatLocal(c.updated_at, "d/MM 'a las' HH:mm")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
