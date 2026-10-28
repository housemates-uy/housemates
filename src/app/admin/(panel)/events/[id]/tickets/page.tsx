import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConfirmSubmitButton, SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, StatCard } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatUYU } from '@/lib/events';
import { formatDocument, normalizeDocument, SOURCE_LABELS, STATUS_LABELS, ticketUrl } from '@/lib/tickets';
import type { TicketStatus } from '@/types/database';
import { cancelTicketAction, resendTicketMailAction } from './actions';
import { CopyLinkButton } from './copy-link-button';
import { NewTicketForm } from './new-ticket-form';

// Entradas de un evento: alta manual / invitación, listado con búsqueda y anulación.
// Las compras web pendientes (todavía pagando) también aparecen, con su estado.
const STATUS_TONE: Record<TicketStatus, 'solid' | 'neutral' | 'alert' | 'club'> = {
  paid: 'solid',
  used: 'club',
  pending: 'neutral',
  cancelled: 'neutral',
  refunded: 'neutral',
};

export default async function EventTicketsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  await requireAdmin();
  const db = createAdminClient();
  const q = searchParams.q?.trim() ?? '';

  const [{ data: tiers }, { data: tickets }] = await Promise.all([
    db
      .from('ticket_tiers')
      .select('id, name, price_uyu, active, quantity_total, quantity_sold')
      .eq('event_id', params.id)
      .order('sort_order'),
    db
      .from('tickets')
      .select(
        'id, buyer_name, buyer_email, buyer_document, buyer_instagram, buyer_phone, status, source, tier_id, amount_paid_uyu, qr_token, created_at, used_at, reserved_until',
      )
      .eq('event_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  // Disponibilidad real (descuenta reservas de compras web en curso).
  const tierOptions = await Promise.all(
    (tiers ?? [])
      .filter((t) => t.active)
      .map(async (t) => {
        const { data } = await db.rpc('tier_available', { p_tier_id: t.id });
        return { id: t.id, name: t.name, price: Number(t.price_uyu), available: (data as number) ?? 0 };
      }),
  );
  const tierName = new Map((tiers ?? []).map((t) => [t.id, t.name]));

  const all = tickets ?? [];
  const now = Date.now();
  // Una compra pendiente con la reserva vencida es un pago abandonado: no se cuenta.
  const live = all.filter(
    (t) => t.status !== 'pending' || (t.reserved_until && new Date(t.reserved_until).getTime() > now),
  );
  const valid = all.filter((t) => t.status === 'paid' || t.status === 'used');
  const revenue = valid.reduce((sum, t) => sum + Number(t.amount_paid_uyu), 0);

  const needle = q.toLowerCase();
  const docNeedle = /\d/.test(q) ? normalizeDocument(q).replace(/^0+/, '') : null;
  const filtered = q
    ? live.filter(
        (t) =>
          t.buyer_name.toLowerCase().includes(needle) ||
          t.buyer_email.includes(needle) ||
          (t.buyer_instagram ?? '').includes(needle.replace(/^@/, '')) ||
          (docNeedle && t.buyer_document.includes(docNeedle)),
      )
    : live;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Entradas válidas" value={valid.length} sub="Pagas + ya usadas" />
        <StatCard label="Ya entraron" value={all.filter((t) => t.status === 'used').length} />
        <StatCard label="Recaudado" value={<span className="text-2xl">{formatUYU(revenue)}</span>} />
        <StatCard
          label="Pagando ahora"
          value={live.filter((t) => t.status === 'pending').length}
          sub="Reservas web en curso"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Nueva entrada</h2>
        <NewTicketForm eventId={params.id} tiers={tierOptions} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Entradas ({filtered.length})</h2>
          <form className="w-full sm:w-72">
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre, CI, email o IG" aria-label="Buscar entradas" />
          </form>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={q ? 'Sin resultados' : 'Todavía no hay entradas'}>
            {q ? (
              <Link href={`/admin/events/${params.id}/tickets`} className="underline">
                Limpiar búsqueda
              </Link>
            ) : (
              'Cargá la primera arriba.'
            )}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {filtered.map((t) => {
              const cancel = cancelTicketAction.bind(null, params.id, t.id);
              const resend = resendTicketMailAction.bind(null, params.id, t.id);
              const cancellable = t.status === 'paid' || t.status === 'pending';
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{t.buyer_name}</p>
                      <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      CI {formatDocument(t.buyer_document)} · {t.buyer_email}
                      {t.buyer_instagram && ` · @${t.buyer_instagram}`}
                    </p>
                    <p className="mt-0.5 text-xs text-bone/45">
                      {SOURCE_LABELS[t.source]}
                      {t.tier_id && ` · ${tierName.get(t.tier_id) ?? ''}`}
                      {Number(t.amount_paid_uyu) > 0 && ` · ${formatUYU(Number(t.amount_paid_uyu))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.qr_token && t.status !== 'pending' && <CopyLinkButton url={ticketUrl(t.qr_token)} />}
                    {t.status === 'paid' && (
                      <form action={resend}>
                        <SubmitButton variant="ghost" size="sm">
                          Reenviar mail
                        </SubmitButton>
                      </form>
                    )}
                    {cancellable && (
                      <form action={cancel}>
                        <ConfirmSubmitButton
                          variant="ghost"
                          size="sm"
                          confirmLabel={t.source === 'purchase' && t.status === 'paid' ? 'Sí, reembolsar' : 'Sí, anular'}
                        >
                          {t.source === 'purchase' && t.status === 'paid' ? 'Reembolsar' : 'Anular'}
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
