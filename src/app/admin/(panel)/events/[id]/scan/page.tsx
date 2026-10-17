import { requireAdmin } from '@/lib/auth/admin';
import { EmptyState } from '@/components/ui/card';

export default async function EventScanPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-sm">
      <EmptyState title="El scanner llega con la ticketera">
        Va a usar la cámara del celular para validar los QR en puerta.
      </EmptyState>
    </div>
  );
}
