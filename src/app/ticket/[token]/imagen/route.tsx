import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { entryTime, formatLocal } from '@/lib/events';
import { loadImageFonts } from '@/lib/image-fonts';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDocument, ticketUrl } from '@/lib/tickets';
import { getTicketTransport } from '@/lib/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /ticket/<token>/imagen → PNG de la entrada (formato historia, 1080×1920) para
// guardar en el celular. Solo para entradas válidas: una usada o anulada no se descarga.
// Es la misma entrada que /ticket/<token> (fondo doodle, letra, punto violeta, datos y bus),
// pasada a 1080 de ancho: cada px de la página son ~2,77 px acá.

const BONE = '#FAFAFA';
const INK = '#0A0A0A';
const VIOLET = '#8A4FFF';
// Mismo estilo que "Válida", "Ingreso hasta" y "Bus" en la página (11px, bold, mayúsculas).
const LABEL = { fontSize: 30, fontWeight: 700, letterSpacing: 4.8, textTransform: 'uppercase' } as const;

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: ticket } = await db
    .from('tickets')
    .select('id, buyer_name, buyer_document, status, source, tier_id, event_id, qr_token')
    .eq('qr_token', params.token)
    .maybeSingle();
  if (!ticket?.qr_token || ticket.status !== 'paid') {
    return new Response('Entrada no disponible', { status: 404 });
  }

  const [{ data: event }, { data: tier }, bus, fonts] = await Promise.all([
    db.from('events').select('date_start, format').eq('id', ticket.event_id).single(),
    ticket.tier_id
      ? db.from('ticket_tiers').select('name, entry_until').eq('id', ticket.tier_id).single()
      : Promise.resolve({ data: null }),
    getTicketTransport(ticket.id),
    loadImageFonts(req),
  ]);

  const qr = await QRCode.toDataURL(ticketUrl(ticket.qr_token), { margin: 1, width: 720, errorCorrectionLevel: 'M' });
  const logo = new URL('/brand/logo.svg', req.url).toString();
  const background = new URL('/brand/ticket-bg.jpg', req.url).toString();
  const doc = formatDocument(ticket.buyer_document);
  const entry = ticket.source === 'invitation' ? 'Cortesía' : (tier?.name ?? 'Entrada');
  const entryUntil = entryTime(tier?.entry_until);
  const when = event ? `${formatLocal(event.date_start, "EEEE · HH:mm 'hs'")} · ${event.format}` : '';

  // Con bus, el logo y el QR se achican para que entre el texto de salida completo (hasta 300
  // caracteres): cada renglón (unos 46 caracteres), el "Ingreso hasta" y un nombre largo que va
  // en dos renglones (unos 26 caracteres por renglón) le sacan lugar al QR.
  const busLines = bus ? bus.departure.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  const wrappedLines = busLines.reduce((n, line) => n + Math.ceil(line.length / 46), 0);
  const nameLines = Math.max(1, Math.ceil(ticket.buyer_name.trim().length / 26));
  const extra = (nameLines - 1) * 66 + (entryUntil ? 58 : 0);
  const size = bus
    ? { pad: 90, logo: 200, qr: Math.max(300, Math.min(440, 677 - wrappedLines * 45 - extra)) }
    : { pad: 100, logo: 254, qr: Math.max(300, Math.min(600, 679 - extra)) };

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: INK,
          color: BONE,
          padding: `${size.pad}px 90px`,
          fontFamily: fonts[0]?.name,
        }}
      >
        {/* Fondo doodle desenfocado, igual que DoodleBackdrop (public/brand/ticket-bg.jpg). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={background} width={1080} height={1920} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={Math.round((size.logo * 260) / 254)} height={size.logo} alt="" style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', flexShrink: 0, marginTop: 51, fontSize: 150, fontWeight: 700, lineHeight: 0.9, letterSpacing: -7 }}>
          {event ? formatLocal(event.date_start, 'dd.MM.yy') : ''}
        </div>
        <div style={{ display: 'flex', flexShrink: 0, marginTop: 22, fontSize: 39, color: 'rgba(250,250,250,0.8)' }}>
          {when.charAt(0).toUpperCase() + when.slice(1)}
        </div>
        <div
          style={{
            marginTop: 51,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '2px solid rgba(250,250,250,0.2)',
            borderRadius: 61,
            background: 'rgba(10,10,10,0.55)',
            padding: 55,
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 33, color: 'rgba(250,250,250,0.65)' }}>{entry}</span>
            <span style={{ display: 'flex', alignItems: 'center', ...LABEL }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: VIOLET, marginRight: 14 }} />
              Válida
            </span>
          </div>
          <div style={{ marginTop: 42, display: 'flex', background: '#FFFFFF', borderRadius: 39, padding: 33 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={size.qr} height={size.qr} alt="" />
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', marginTop: 42, fontSize: 55, fontWeight: 700 }}
          >
            {ticket.buyer_name}
          </div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 36, color: 'rgba(250,250,250,0.7)' }}>
            {`CI ${doc}`}
          </div>
          {entryUntil && <div style={{ display: 'flex', marginTop: 22, ...LABEL }}>{`Ingreso hasta ${entryUntil}`}</div>}
          {bus && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22, width: '100%' }}>
              <div style={{ display: 'flex', ...LABEL }}>{`Bus · ${bus.name}`}</div>
              {busLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    marginTop: i === 0 ? 8 : 0,
                    fontSize: 33,
                    lineHeight: 1.375,
                    color: 'rgba(250,250,250,0.7)',
                    textAlign: 'center',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 24, fontSize: 33, color: 'rgba(250,250,250,0.6)' }}>
          Entrada personal · En puerta te pedimos la cédula
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        'Content-Disposition': `attachment; filename="entrada-house-mates.png"`,
        'Cache-Control': 'no-store',
      },
    },
  );
}
