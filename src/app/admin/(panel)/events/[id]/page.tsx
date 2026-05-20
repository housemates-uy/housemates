import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatusBadge } from '@/components/admin/events/status-badge'
import { toggleSalesAction, archiveEventAction, toggleTierActiveAction, toggleTierSoldOutAction } from './actions'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TicketTier } from '@/types/database'

const TZ = 'America/Montevideo'

export default async function EventOverviewPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  const db = createAdminClient()

  const { data: event } = await db
    .from('events')
    .select('*, ticket_tiers(*)')
    .eq('id', params.id)
    .single()

  if (!event) notFound()

  const { count: ticketCount } = await db
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', params.id)
    .eq('status', 'paid')

  const tiers = ((event.ticket_tiers as TicketTier[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const local = toZonedTime(new Date(event.date_start), TZ)

  const toggleSales = toggleSalesAction.bind(null, event.id, event.sales_active)
  const archive = archiveEventAction.bind(null, event.id)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Tickets vendidos"
          value={ticketCount ?? 0}
          sub={`de ${event.capacity} lugares`}
        />
        <StatCard
          label="Fecha"
          value={format(local, "d MMM yyyy", { locale: es })}
          sub={format(local, "HH:mm 'hs'", { locale: es })}
        />
        <div className="border border-white/8 bg-white/3 p-5">
          <p className="text-xs tracking-widest text-bone/40 uppercase">Estado</p>
          <div className="mt-2">
            <StatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-xs text-bone/30">
            {event.sales_active ? 'Ventas activas' : 'Ventas pausadas'}
          </p>
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="border border-white/8 divide-y divide-white/8">
          <p className="px-5 py-3 text-xs tracking-widest text-bone/40 uppercase">Tiers</p>
          {tiers.map((tier) => {
            const isSoldOut = tier.sold_out_override || tier.quantity_sold >= tier.quantity_total
            const toggleActive = toggleTierActiveAction.bind(null, tier.id, params.id, tier.active)
            const toggleSoldOut = toggleTierSoldOutAction.bind(null, tier.id, params.id, tier.sold_out_override)
            return (
              <div key={tier.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-bone">{tier.name}</p>
                    {!tier.active && (
                      <span className="text-xs text-bone/40 border border-white/10 px-1.5 py-0.5 leading-none">inactiva</span>
                    )}
                    {isSoldOut && (
                      <span className="text-xs text-red-400/70 border border-red-400/30 px-1.5 py-0.5 leading-none">agotada</span>
                    )}
                  </div>
                  {tier.description && <p className="text-xs text-bone/35 mt-0.5">{tier.description}</p>}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-sm text-bone/50 tabular-nums">
                    ${tier.price_uyu.toLocaleString('es-UY')} · {tier.quantity_sold}/{tier.quantity_total}
                  </p>
                  {event.status !== 'archived' && (
                    <div className="flex items-center gap-3">
                      <form action={toggleActive}>
                        <button type="submit" className="text-xs text-bone/30 hover:text-bone/70 transition-colors">
                          {tier.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                      <form action={toggleSoldOut}>
                        <button type="submit" className="text-xs text-bone/30 hover:text-bone/70 transition-colors">
                          {tier.sold_out_override ? 'Restaurar' : 'Agotar'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/events/${params.id}/edit`}
          className="border border-bone/20 px-4 py-2 text-xs tracking-widest text-bone/60 uppercase hover:border-bone/40 hover:text-bone transition-colors"
        >
          Editar
        </Link>

        {event.status !== 'archived' && (
          <form action={toggleSales}>
            <button
              type="submit"
              className="border border-white/10 px-4 py-2 text-xs tracking-widest text-bone/50 uppercase hover:border-bone/30 hover:text-bone transition-colors"
            >
              {event.sales_active ? 'Pausar ventas' : 'Activar ventas'}
            </button>
          </form>
        )}

        {admin.role === 'owner' && event.status !== 'archived' && (
          <form action={archive}>
            <button
              type="submit"
              className="border border-white/8 px-4 py-2 text-xs tracking-widest text-bone/30 uppercase hover:border-red-400/30 hover:text-red-400/60 transition-colors"
            >
              Archivar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="border border-white/8 bg-white/3 p-5">
      <p className="text-xs tracking-widest text-bone/40 uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-light text-bone">{value}</p>
      <p className="mt-1 text-xs text-bone/30">{sub}</p>
    </div>
  )
}
