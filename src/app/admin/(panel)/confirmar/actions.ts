'use server';

// Entradas a confirmar: aceptar o declinar una transferencia (solo owners, lo chequea
// src/lib/transfers.ts). Reglas: ver docs/LOGICA_DE_NEGOCIO.md → "Transferencia".
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { approveTransfer, rejectTransfer, type TransferOutcome } from '@/lib/transfers';

function outcomeSlug(done: 'aceptada' | 'declinada', { result, mailed }: TransferOutcome): string {
  if (result === 'approved' || result === 'rejected') return mailed ? done : `${done}-sin-mail`;
  if (result === 'not_in_review') return 'ya-resuelta';
  if (result === 'no_receipt') return 'sin-comprobante';
  return 'error';
}

// El resultado viaja por la URL (?hecho=…&entrada=…): el loading.tsx raíz vuelve a montar la
// página y un estado local se perdería. Se revalida todo el admin por el contador del menú.
function backToPanel(ticketId: string, eventFilter: string | null, hecho: string): never {
  const params = new URLSearchParams({ hecho, entrada: ticketId });
  if (eventFilter) params.set('evento', eventFilter);
  revalidatePath('/admin', 'layout');
  redirect(`/admin/confirmar?${params}`);
}

export async function acceptTransferAction(
  ticketId: string,
  eventFilter: string | null,
): Promise<void> {
  backToPanel(ticketId, eventFilter, outcomeSlug('aceptada', await approveTransfer(ticketId)));
}

export async function declineTransferAction(
  ticketId: string,
  eventFilter: string | null,
): Promise<void> {
  backToPanel(ticketId, eventFilter, outcomeSlug('declinada', await rejectTransfer(ticketId)));
}
