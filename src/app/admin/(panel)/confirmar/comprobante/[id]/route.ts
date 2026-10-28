import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/admin';
import { receiptSignedUrl } from '@/lib/receipts';
import { createAdminClient } from '@/lib/supabase/admin';

// El comprobante de una entrada, solo para owners: arma en el momento un link temporal de
// 60 segundos al bucket privado y redirige. Así la página nunca tiene un link vencido y el
// link real dura lo justo para que el navegador lo abra.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (admin?.role !== 'owner') {
    return new NextResponse('Solo los owners ven los comprobantes.', { status: 403 });
  }

  const { data: ticket } = await createAdminClient()
    .from('tickets')
    .select('receipt_path')
    .eq('id', params.id)
    .maybeSingle();
  const url = ticket?.receipt_path ? await receiptSignedUrl(ticket.receipt_path, 60) : null;
  if (!url) return new NextResponse('No encontramos el comprobante.', { status: 404 });

  const response = NextResponse.redirect(url, 302);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
