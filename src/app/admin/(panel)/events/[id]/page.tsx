import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatusBadge } from '@/components/admin/events/status-badge';
import { ConfirmSubmitButton, SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, StatCard } from '@/components/ui/card';
import { formatLocal, formatUYU } from '@/lib/events';
import type { TicketTier } from '@/types/database';
import {
  toggleSalesAction,
  archiveEventAction,
  toggleTierActiveAction,
  toggleTierSoldOutAction,
} from './actions';

export default async function EventOverviewPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const { data: event } = await db
    .from('events')
    .select('*, ticket_tiers(*)')
    .eq('id', params.id)
    .single();

  if (!event) notFound();

  const { count: ticketCount } = await db
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', params.id)
    .eq('status', 'paid');

  const tiers = ((event.ticket_tiers as TicketTier[]) ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const toggleSales = toggleSalesAction.bind(null, event.id, event.sales_active);
  const archive = archiveEventAction.bind(null, event.id);
  const editable = event.status !== 'archived';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tickets vendidos"
          value={ticketCount ?? 0}
          sub={`de ${event.capacity} lugares`}
        />
        <StatCard
          label="Fecha"
          value={<span className="text-2xl">{formatLocal(event.date_start, 'd MMM yyyy')}</span>}
          sub={formatLocal(event.date_start, "HH:mm 'hs'")}
        />
        <Card>
          <p className="text-[13px] text-bone/50">Estado</p>
          <div className="mt-3">
            <StatusBadge status={event.status} />
          </div>
          <p className="mt-2 text-xs text-bone/45">
            {event.sales_active ? 'Ventas activas' : 'Ventas pausadas'}
          </p>
        </Card>
      </div>

      {tiers.length > 0 && (
        <section className="rounded-card border border-bone/10">
          <h2 className="border-b border-bone/10 px-5 py-3 text-sm font-medium text-bone/70">Tiers</h2>
          <ul className="divide-y divide-bone/10">
            {tiers.map((tier) => {
              const isSoldOut = tier.sold_out_override || tier.quantity_sold >= tier.quantity_total;
              const toggleActive = toggleTierActiveAction.bind(null, tier.id, params.id, tier.active);
              const toggleSoldOut = toggleTierSoldOutAction.bind(
                null,
                tier.id,
                params.id,
                tier.sold_out_override,
              );
              return (
                <li key={tier.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{tier.name}</p>
                      {!tier.active && <Badge>Inactiva</Badge>}
                      {isSoldOut && <Badge tone="alert">Sold out</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      {formatUYU(tier.price_uyu)} · {tier.quantity_sold}/{tier.quantity_total}
                      {tier.description && ` · ${tier.description}`}
                    </p>
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1">
                      <form action={toggleActive}>
                        <SubmitButton variant="ghost" size="sm">
                          {tier.active ? 'Desactivar' : 'Activar'}
                        </SubmitButton>
                      </form>
                      <form action={toggleSoldOut}>
                        <SubmitButton variant="ghost" size="sm">
                          {tier.sold_out_override ? 'Restaurar' : 'Agotar'}
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/events/${params.id}/edit`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Editar
        </Link>

        {editable && (
          <form action={toggleSales}>
            <SubmitButton variant="outline" size="sm">
              {event.sales_active ? 'Pausar ventas' : 'Activar ventas'}
            </SubmitButton>
          </form>
        )}

        {admin.role === 'owner' && editable && (
          <form action={archive}>
            <ConfirmSubmitButton variant="ghost" size="sm" confirmLabel="Sí, archivar">
              Archivar
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
