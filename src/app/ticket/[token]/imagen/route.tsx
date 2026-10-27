import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { ticketUrl } from '@/lib/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /ticket/<token>/imagen → PNG de la entrada (formato historia, 1080×1920) para
// guardar en el celular. Solo para entradas válidas: una usada o anulada no se descarga.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('buyer_name, buyer_document, status, source, tier_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!ticket?.qr_token || ticket.status !== 'paid') {
    return new Response('Entrada no disponible', { status: 404 });
  }

  const [{ data: event }, { data: tier }] = await Promise.all([
    db.from('events').select('title, date_start').eq('id', ticket.event_id).single(),
    ticket.tier_id
      ? db.from('ticket_tiers').select('name').eq('id', ticket.tier_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const qr = await QRCode.toDataURL(ticketUrl(ticket.qr_token), { margin: 1, width: 720, errorCorrectionLevel: 'M' });
  const logo = new URL('/brand/logo.svg', req.url).toString();
  const doc = ticket.buyer_document.slice(-4);
  const entry = ticket.source === 'invitation' ? 'Invitación' : (tier?.name ?? 'Entrada');

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
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={260} height={254} alt="" />
        <div style={{ display: 'flex', marginTop: 60, fontSize: 150, fontWeight: 700, letterSpacing: -6 }}>
          {event ? formatLocal(event.date_start, 'dd.MM.yy') : ''}
        </div>
        <div style={{ display: 'flex', marginTop: 10, fontSize: 40, opacity: 0.75 }}>{event?.title ?? ''}</div>
        <div
          style={{
            marginTop: 70,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '2px solid rgba(250,250,250,0.2)',
            borderRadius: 50,
            padding: 60,
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 34 }}>
            <span style={{ opacity: 0.7 }}>{entry}</span>
            <span style={{ fontWeight: 700, letterSpacing: 5 }}>VÁLIDA</span>
          </div>
          <div style={{ marginTop: 40, display: 'flex', background: '#FFFFFF', borderRadius: 30, padding: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={600} height={600} alt="" />
          </div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 56, fontWeight: 700 }}>{ticket.buyer_name}</div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 36, opacity: 0.7 }}>
            {`CI •••• ${doc.slice(0, 3)}-${doc.slice(3)}`}
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 32, opacity: 0.6 }}>
          Entrada personal · En puerta te pedimos la cédula
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        'Content-Disposition': `attachment; filename="entrada-house-mates.png"`,
        'Cache-Control': 'no-store',
      },
    },
  );
}
