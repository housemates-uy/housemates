import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatusBadge } from '@/components/admin/events/status-badge'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'

export const metadata = { title: 'Eventos — Admin HOUSE MATES' }

const TZ = 'America/Montevideo'

export default async function EventsPage() {
  await requireAdmin()
  const db = createAdminClient()

  const { data: events } = await db
    .from('events')
    .select('id, title, slug, date_start, status, capacity, sales_active')
    .order('date_start', { ascending: false })

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-light text-bone">Eventos</h1>
          <p className="mt-1 text-sm text-bone/40">
            {events?.length ?? 0} evento{events?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="border border-bone/20 px-4 py-2 text-xs tracking-widest text-bone uppercase hover:border-bone/50 hover:bg-white/5 transition-colors"
        >
          Nuevo evento
        </Link>
      </div>

      {events && events.length > 0 ? (
        <div className="border border-white/8 divide-y divide-white/8">
          {events.map((event) => {
            const local = toZonedTime(new Date(event.date_start), TZ)
            return (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
              >
                <div>
                  <p className="text-sm text-bone">{event.title}</p>
                  <p className="mt-0.5 text-xs text-bone/40">
                    {format(local, "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                    {' · '}
                    {event.capacity} lugares
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {event.sales_active && (
                    <span className="text-xs text-ember tracking-widest uppercase">ventas activas</span>
                  )}
                  <StatusBadge status={event.status} />
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="border border-white/8 bg-white/3 p-12 text-center">
          <CalendarDays size={32} strokeWidth={1} className="mx-auto mb-4 text-bone/20" />
          <p className="text-sm text-bone/40">Sin eventos. Creá el primero.</p>
        </div>
      )}
    </div>
  )
}
