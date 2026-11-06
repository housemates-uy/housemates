import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatusBadge } from '@/components/admin/events/status-badge';
import { TierTags } from '@/components/admin/events/tier-fields';
import { ContextMenu, ContextMenuButton, type ContextMenuItem } from '@/components/admin/context-menu';
import { ConfirmSubmitButton, SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, StatCard } from '@/components/ui/card';
import { formatLocal, formatUYU } from '@/lib/events';
import type { TicketTier } from '@/types/database';
import {
  toggleSalesAction,
  archiveEventAction,
  deleteTierAction,
  toggleTierActiveAction,
  toggleTierSoldOutAction,
} from './actions';
import { CommsSection } from './comms';
import { PresaleSection } from './presale';

// Los envíos de "Comunicación" y de "Preventa" corren en las server actions de esta página.
export const maxDuration = 60;

export default async function EventOverviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const { data: event } = await db
    .from('events')
    .select('*, ticket_tiers(*)')
    .eq('id', params.id)
    .single();

  if (!event) notFound();

  // Igual que "Entradas válidas" de Ventas: pagas + ya usadas (no baja cuando la gente entra),
  // invitaciones incluidas porque también ocupan lugar de la capacidad.
  const [{ count: validCount }, { count: invitationCount }] = await Promise.all([
    db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .in('status', ['paid', 'used']),
    db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .in('status', ['paid', 'used'])
      .eq('source', 'invitation'),
  ]);

  const tiers = ((event.ticket_tiers as TicketTier[]) ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  // Precios, cupos, tandas y ventas: solo los owners (los socios).
  const isOwner = admin.role === 'owner';
  const editable = event.status !== 'archived';

  // Una tanda con alguna entrada (de cualquier estado) no se elimina: se desactiva.
  const tiersWithTickets = new Set(
    isOwner
      ? (
          await Promise.all(
            tiers.map(async (t) => {
              const { count } = await db
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('tier_id', t.id);
              return count ? t.id : null;
            }),
          )
        ).filter(Boolean)
      : [],
  );

  const tierMenu = (tier: TicketTier): ContextMenuItem[] => {
    if (!isOwner) return [];
    const hasTickets = tiersWithTickets.has(tier.id);
    return [
      { label: 'Editar', href: `/admin/events/${params.id}/edit#tanda-${tier.id}` },
      ...(editable
        ? [
            {
              label: tier.active ? 'Desactivar' : 'Activar',
              hint: hasTickets
                ? `Tiene entradas: ${tier.active ? 'se puede desactivar' : 'no se puede eliminar'}`
                : undefined,
              action: toggleTierActiveAction.bind(null, tier.id, params.id, tier.active),
            },
            {
              label: tier.sold_out_override ? 'Restaurar' : 'Agotar',
              action: toggleTierSoldOutAction.bind(null, tier.id, params.id, tier.sold_out_override),
            },
          ]
        : []),
      ...(hasTickets
        ? []
        : [
            {
              label: 'Eliminar',
              danger: true,
              action: deleteTierAction.bind(null, tier.id, params.id),
              confirm: { title: `¿Eliminar la tanda ${tier.name}?`, body: 'No se puede deshacer.', label: 'Sí, eliminar' },
            },
          ]),
    ];
  };

  const toggleSales = toggleSalesAction.bind(null, event.id, event.sales_active);
  const archive = archiveEventAction.bind(null, event.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Entradas válidas"
          value={validCount ?? 0}
          sub={`de ${event.capacity} lugares${invitationCount ? ` · ${invitationCount} ${invitationCount === 1 ? 'invitación' : 'invitaciones'}` : ''}`}
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
          <h2 className="border-b border-bone/10 px-5 py-3 text-sm font-medium text-bone/70">Tandas</h2>
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
                <ContextMenu
                  key={tier.id}
                  as="li"
                  label={`Acciones de la tanda ${tier.name}`}
                  items={tierMenu(tier)}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{tier.name}</p>
                      {!tier.active && <Badge>Inactiva</Badge>}
                      {isSoldOut && <Badge tone="alert">Agotada</Badge>}
                      <TierTags tier={tier} />
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      {formatUYU(tier.price_uyu)} · {tier.quantity_sold}/{tier.quantity_total}
                      {tier.description && ` · ${tier.description}`}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      {editable && (
                        <>
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
                        </>
                      )}
                      <ContextMenuButton />
                    </div>
                  )}
                </ContextMenu>
              );
            })}
          </ul>
        </section>
      )}

      {isOwner && (
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/events/${params.id}/edit`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Editar
        </Link>

        <Link
          href={`/admin/events/${params.id}/duplicar`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Duplicar para otra fecha
        </Link>

        {editable && (
          <form action={toggleSales}>
            <SubmitButton variant="outline" size="sm">
              {event.sales_active ? 'Pausar ventas' : 'Activar ventas'}
            </SubmitButton>
          </form>
        )}

        {editable && (
          <form action={archive}>
            <ConfirmSubmitButton variant="ghost" size="sm" confirmLabel="Sí, archivar">
              Archivar
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
      )}

      <PresaleSection
        eventId={event.id}
        tiers={tiers}
        isOwner={admin.role === 'owner'}
        canSend={editable && new Date(event.date_end) > new Date()}
        searchParams={searchParams}
      />

      <CommsSection
        eventId={event.id}
        isOwner={admin.role === 'owner'}
        searchParams={searchParams}
      />
    </div>
  );
}
