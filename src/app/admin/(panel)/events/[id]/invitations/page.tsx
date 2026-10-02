import { requireAdmin } from '@/lib/auth/admin';
import { EmptyState } from '@/components/ui/card';

export default async function EventInvitationsPage() {
  await requireAdmin();

  return (
    <div className="max-w-4xl">
      <EmptyState title="Las invitaciones llegan con la ticketera">
        Vas a poder invitar por email: generan el mismo QR que una entrada paga.
      </EmptyState>
    </div>
  );
}
