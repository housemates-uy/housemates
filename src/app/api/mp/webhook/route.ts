import { NextResponse, type NextRequest } from 'next/server';
import { syncPayment, verifyWebhookSignature } from '@/lib/mercadopago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook de Mercado Pago: MP avisa acá cada cambio en un pago.
// - Se verifica la firma si MP_WEBHOOK_SECRET está configurado.
// - Nunca se usa el contenido del aviso: con el id se consulta el pago a la API de MP
//   (syncPayment). Por eso un aviso falso no puede aprobar una entrada.
// - Es idempotente (MP reintenta si no respondemos 200): confirmar dos veces no hace nada.
export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {
    // MP a veces manda solo query params
  }

  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type;
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? (body.data?.id ? String(body.data.id) : null);

  if (!process.env.MP_WEBHOOK_SECRET) {
    console.warn('[mp-webhook] MP_WEBHOOK_SECRET no configurado: no se verifica la firma');
  } else {
    const ok = verifyWebhookSignature({
      signature: req.headers.get('x-signature'),
      requestId: req.headers.get('x-request-id'),
      dataId,
    });
    if (!ok) {
      console.warn('[mp-webhook] firma inválida', { dataId, type });
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }
  }

  if (type !== 'payment' || !dataId) return NextResponse.json({ ignored: true });

  try {
    const result = await syncPayment(dataId);
    return NextResponse.json({ ok: true, status: result.status, result: result.result ?? null });
  } catch (err) {
    console.error('[mp-webhook] no se pudo consultar el pago', dataId, (err as Error)?.message);
    // 500 → MP reintenta más tarde.
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 });
  }
}
