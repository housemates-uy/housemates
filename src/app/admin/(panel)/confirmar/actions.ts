'use server';

// Entradas a confirmar: aceptar o declinar la transferencia de una compra entera (solo owners,
// lo chequea src/lib/transfers.ts). ticketId es la entrada de quien compró: la acción resuelve
// todo su grupo. Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { approveTransfer, rejectTransfer, type TransferOutcome } from '@/lib/transfers';

function outcomeSlug(done: 'aceptada' | 'declinada', { result, mailed }: TransferOutcome): string {
  if (result === 'approved' || result === 'rejected') return mailed ? done : `${done}-sin-mail`;
  if (result === 'not_in_review') return 'ya-resuelta';
  if (result === 'no_receipt') return 'sin-comprobante';
  return 'error';
}

// El resultado viaja por la URL (?hecho=…&entrada=…&n=…): el loading.tsx raíz vuelve a montar
// la página y un estado local se perdería. Se revalida todo el admin por el contador del menú.
function backToPanel(
  ticketId: string,
  eventFilter: string | null,
  done: 'aceptada' | 'declinada',
  outcome: TransferOutcome,
): never {
  const params = new URLSearchParams({ hecho: outcomeSlug(done, outcome), entrada: ticketId });
  if (outcome.count > 1) params.set('n', String(outcome.count));
  if (eventFilter) params.set('evento', eventFilter);
  revalidatePath('/admin', 'layout');
  redirect(`/admin/confirmar?${params}`);
}

export async function acceptTransferAction(
  ticketId: string,
  eventFilter: string | null,
): Promise<void> {
  backToPanel(ticketId, eventFilter, 'aceptada', await approveTransfer(ticketId));
}

export async function declineTransferAction(
  ticketId: string,
  eventFilter: string | null,
): Promise<void> {
  backToPanel(ticketId, eventFilter, 'declinada', await rejectTransfer(ticketId));
}
