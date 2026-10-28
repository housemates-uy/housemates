import { ConfirmSubmitButton } from '@/components/admin/submit-button';
import { Card } from '@/components/ui/card';
import { formatUYU } from '@/lib/events';
import { presaleAudience, presaleBlocker, presaleUrl } from '@/lib/mail/presale-mails';
import type { TicketTier } from '@/types/database';
import { sendPresaleAction } from './actions';
import { CopyLinkButton } from './tickets/copy-link-button';

type SearchParams = Record<string, string | undefined>;

// Tandas de preventa del evento: el link para compartir y el mail a quienes vinieron antes.
// Ver docs/LOGICA_DE_NEGOCIO.md → "Tandas". Mandar: solo owners.
export async function PresaleSection({
  eventId,
  tiers,
  isOwner,
  canSend,
  searchParams,
}: {
  eventId: string;
  tiers: TicketTier[];
  isOwner: boolean;
  canSend: boolean; // el evento no terminó ni está archivado
  searchParams: SearchParams;
}) {
  const presale = tiers.filter((t) => t.presale_code);
  if (presale.length === 0) return null;
  const [audiences, blockers] = await Promise.all([
    Promise.all(presale.map((t) => presaleAudience(t.id))),
    Promise.all(presale.map((t) => presaleBlocker(t.id))),
  ]);

  return (
    <section id="preventa" aria-labelledby="preventa-titulo" className="scroll-mt-6 space-y-4">
      <div>
        <h2 id="preventa-titulo" className="text-lg font-bold tracking-tight">
          Preventa
        </h2>
        <p className="mt-1 text-sm text-bone/55">
          Estas tandas no se ven en /entradas: se compran solo con el link. El mail va a quienes tienen
          una entrada válida o usada de un evento anterior (un mail por persona), salvo quienes ya
          tienen entrada para este.
        </p>
      </div>

      {presale.map((tier, i) => {
        const audience = audiences[i];
        const blocker = blockers[i];
        const url = presaleUrl(tier.presale_code!);
        const pending = audience.pending.length;
        return (
          <Card key={tier.id} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">
                {tier.name} <span className="text-bone/50">· {formatUYU(tier.price_uyu)}</span>
              </h3>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet">{tier.presale_code}</p>
            </div>

            <div className="flex items-center gap-2 rounded-control border border-bone/10 bg-bone/[0.03] py-1 pl-3.5 pr-1">
              <p className="min-w-0 flex-1 truncate font-mono text-xs text-bone/75">{url}</p>
              <CopyLinkButton url={url} />
            </div>

            <PresaleNotice tierId={tier.id} blocker={blocker} searchParams={searchParams} />

            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-bold tracking-tight">
                {audience.received}{' '}
                <span className="text-sm font-normal text-bone/50">de {audience.total} lo recibieron</span>
              </p>
              {!isOwner ? (
                <p className="text-xs text-bone/55">Solo los owners pueden mandar.</p>
              ) : !canSend ? (
                <p className="text-xs text-bone/55">El evento terminó.</p>
              ) : blocker && pending > 0 ? (
                <p className="max-w-xs text-right text-xs text-alert">{blocker}</p>
              ) : pending > 0 ? (
                <form key={`presale-${tier.id}-${searchParams.t}`} action={sendPresaleAction.bind(null, eventId, tier.id)}>
                  <ConfirmSubmitButton variant="outline" size="sm" confirmLabel={`Sí, mandar ${pending}`}>
                    Mandar preventa a quienes vinieron antes ({pending})
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <p className="text-xs text-bone/55">
                  {audience.total === 0 ? 'No hay asistentes de eventos anteriores.' : 'Ya lo recibieron todos.'}
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

// Resultado del último envío (llega por la URL desde sendPresaleAction).
function PresaleNotice({
  tierId,
  blocker,
  searchParams,
}: {
  tierId: string;
  blocker: string | null;
  searchParams: SearchParams;
}) {
  if (searchParams.preventa !== tierId) return null;
  const sent = Number(searchParams.p_ok ?? 0);
  const failed = Number(searchParams.p_fallaron ?? 0);
  const left = Number(searchParams.p_quedan ?? 0);
  const skipped = Number(searchParams.p_salteados ?? 0);
  if (searchParams.p_bloqueada) {
    return (
      <p role="alert" className="rounded-card border border-alert/40 px-4 py-3 text-sm text-alert">
        No se mandó la preventa.{blocker ? ` ${blocker}` : ' Probá de nuevo.'}
      </p>
    );
  }

  let message = sent === 1 ? 'Se mandó 1 mail.' : `Se mandaron ${sent} mails.`;
  if (sent === 0 && failed > 0) {
    message = 'No salió ningún mail. Revisá la configuración del correo o si se llegó al límite diario de Gmail.';
  } else if (failed > 0) {
    message += ` ${failed === 1 ? '1 no salió' : `${failed} no salieron`}: quedan pendientes.`;
  }
  if (skipped > 0) {
    message += ` ${skipped === 1 ? 'A 1 persona ya se la estaba' : `A ${skipped} personas ya se la estaba`} mandando otro envío al mismo tiempo: no se repitió.`;
  }
  if (left > 0 && sent > 0) message += ` Quedan ${left} por mandar: tocá de nuevo para seguir.`;

  return (
    <p role="status" className="rounded-card border border-bone/15 bg-bone/[0.04] px-4 py-3 text-sm text-bone/80">
      {message}
    </p>
  );
}
