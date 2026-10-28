import { Badge } from '@/components/ui/badge';
import type { EventStatus } from '@/types/database';

const labels: Record<EventStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={status === 'published' ? 'solid' : 'neutral'}>{labels[status]}</Badge>;
}
