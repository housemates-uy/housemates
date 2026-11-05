import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/admin';
import { receiptSignedUrl } from '@/lib/receipts';
import { createAdminClient } from '@/lib/supabase/admin';

// El comprobante de devolución de una entrada anulada (§5.4), solo para owners. Igual que el
// de la transferencia (/admin/confirmar/comprobante/<id>): arma en el momento un link de 60
// segundos al bucket privado y redirige, así la página nunca tiene un link vencido.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string; ticketId: string } }) {
  const admin = await getAdminUser();
  if (admin?.role !== 'owner') {
    return new NextResponse('Solo los owners ven los comprobantes.', { status: 403 });
  }

  const { data: ticket } = await createAdminClient()
    .from('tickets')
    .select('refund_receipt_path')
    .eq('id', params.ticketId)
    .eq('event_id', params.id)
    .maybeSingle();
  const url = ticket?.refund_receipt_path ? await receiptSignedUrl(ticket.refund_receipt_path, 60) : null;
  if (!url) return new NextResponse('No encontramos el comprobante de devolución.', { status: 404 });

  const response = NextResponse.redirect(url, 302);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
