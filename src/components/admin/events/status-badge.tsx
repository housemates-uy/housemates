import { clsx } from 'clsx'
import type { EventStatus } from '@/types/database'

const labels: Record<EventStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={clsx('text-xs tracking-widest uppercase', {
        'text-bone/40': status === 'draft',
        'text-green-400/70': status === 'published',
        'text-bone/25': status === 'archived',
      })}
    >
      {labels[status]}
    </span>
  )
}
