import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { barUnitUrl } from '@/lib/bar';
import { formatLocal } from '@/lib/events';
import { loadImageFonts } from '@/lib/image-fonts';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /barra/qr/<token>/imagen → PNG de un trago (formato historia, 1080×1920) para guardar
// en el celular. Solo si el pedido está pago y el trago no se entregó todavía.
// Misma letra que la imagen de la entrada (src/lib/image-fonts.ts).

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: unit } = await db
    .from('bar_order_units')
    .select('product_name, delivered_at, order_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!unit || unit.delivered_at) return new Response('Trago no disponible', { status: 404 });

  const [{ data: order }, { data: event }] = await Promise.all([
    db.from('bar_orders').select('status').eq('id', unit.order_id).single(),
    db.from('events').select('title, date_start').eq('id', unit.event_id).single(),
  ]);
  if (order?.status !== 'paid') return new Response('Trago no disponible', { status: 404 });

  const fonts = await loadImageFonts(req);
  const qr = await QRCode.toDataURL(barUnitUrl(unit.qr_token), { margin: 1, width: 720, errorCorrectionLevel: 'M' });
  const logo = new URL('/brand/logo.svg', req.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: '#0A0A0A',
          color: '#FAFAFA',
          padding: '120px 90px',
          fontFamily: fonts[0]?.name,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={260} height={254} alt="" />
        <div style={{ display: 'flex', marginTop: 60, fontSize: 36, letterSpacing: 10, opacity: 0.6 }}>
          {`BARRA · ${event ? formatLocal(event.date_start, 'dd.MM.yy') : ''}`}
        </div>
        <div
          style={{
            marginTop: 60,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '2px solid rgba(250,250,250,0.2)',
            borderRadius: 50,
            padding: 60,
          }}
        >
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, textAlign: 'center', letterSpacing: -2 }}>
            {unit.product_name}
          </div>
          <div style={{ marginTop: 50, display: 'flex', background: '#FFFFFF', borderRadius: 30, padding: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={600} height={600} alt="" />
          </div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 36, opacity: 0.7 }}>{event?.title ?? ''}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 32, opacity: 0.6 }}>
          Vale un trago · Se usa una sola vez
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        'Content-Disposition': 'attachment; filename="trago-house-mates.png"',
        'Cache-Control': 'no-store',
      },
    },
  );
}
