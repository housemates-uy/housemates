// ============================================================
// Plantillas de mail con el branding de House Mates.
// Diseño aprobado en Claude Design ("Mails House Mates").
// ============================================================
// HTML de mail = tablas + estilos inline (Gmail, Outlook y Apple Mail ignoran casi todo lo
// demás). Fondo negro de marca, texto blanco, un solo botón blanco por mail.
// Cada plantilla devuelve { subject, html, text }: el texto plano es para clientes que no
// muestran HTML y mejora la entrega (menos spam).
import { formatUYU } from '@/lib/events';
import { appUrl } from '@/lib/tickets';

const C = {
  ink: '#0A0A0A',
  bone: '#FAFAFA',
  soft: '#B3B3B3',
  muted: '#8C8C8C',
  line: '#2A2A2A',
  panel: '#161616',
};
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const IG_URL = 'https://instagram.com/house__mates';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function layout(inner: string, preheader: string) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>House Mates</title></head>
<body style="margin:0;padding:0;background:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${FONT};color:${C.bone};">
<tr><td align="center" style="padding-bottom:32px;">
<img src="${appUrl()}/brand/logo-mail.png" width="120" height="120" alt="House Mates" style="display:block;border:0;">
</td></tr>
${inner}
<tr><td align="center" style="padding-top:36px;font-size:12px;line-height:1.6;color:${C.muted};">
¿Dudas? Escribinos por Instagram <a href="${IG_URL}" style="color:${C.bone};">@house__mates</a><br>House Mates · Uruguay
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function heading(eyebrow: string, title: string, body: string) {
  return `<tr><td align="center" style="font-size:12px;font-weight:700;letter-spacing:3px;color:${C.soft};">${esc(eyebrow)}</td></tr>
<tr><td align="center" style="padding-top:12px;font-size:30px;font-weight:700;line-height:1.15;color:${C.bone};">${esc(title)}</td></tr>
<tr><td align="center" style="padding-top:12px;font-size:15px;line-height:1.55;color:${C.soft};">${esc(body)}</td></tr>`;
}

function rows(items: [string, string][], totalRow?: [string, string]) {
  const r = items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:${C.soft};">${esc(k)}</td><td align="right" style="padding:6px 0;font-size:14px;color:${C.bone};">${esc(v)}</td></tr>`,
    )
    .join('');
  const t = totalRow
    ? `<tr><td style="padding:10px 0 0;border-top:1px solid ${C.line};font-size:15px;font-weight:700;">${esc(totalRow[0])}</td><td align="right" style="padding:10px 0 0;border-top:1px solid ${C.line};font-size:15px;font-weight:700;">${esc(totalRow[1])}</td></tr>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r}${t}</table>`;
}

function button(href: string, label: string, outline = false) {
  const style = outline
    ? `border:1px solid ${C.muted};color:${C.bone};background:${C.ink};`
    : `background:${C.bone};color:${C.ink};`;
  return `<tr><td style="padding-top:24px;"><a href="${href}" style="display:block;${style}text-decoration:none;text-align:center;font-size:16px;font-weight:600;padding:16px;border-radius:10px;font-family:${FONT};">${esc(label)}</a></td></tr>`;
}

export type TicketMailData = {
  firstName: string;
  fullName: string;
  docTail: string; // últimos 4 dígitos, p. ej. "6783"
  eventTitle: string;
  dateLong: string; // "Viernes 11 de diciembre · 23:00 hs"
  dateShort: string; // "11.12.26"
  entryLabel: string; // "Tanda 3" o "Invitación"
  ticketUrl: string;
  price: number | null; // precio de la entrada (compra web)
  fee: number | null; // cargo por servicio (compra web)
  total: number; // lo que pagó (0 en invitaciones)
};

const ciMasked = (tail: string) => `CI •••• ${tail.slice(0, 3)}-${tail.slice(3)}`;

// 1 · Entrada confirmada: compra web aprobada, entrada manual o invitación.
// El QR va como imagen adjunta embebida (cid:qr) porque Gmail no muestra imágenes data:.
export function ticketConfirmedEmail(d: TicketMailData) {
  const subject = `Tu entrada para ${d.eventTitle} · ${d.dateShort}`;
  const payment: [string, string][] = [];
  let total: [string, string] | undefined;
  if (d.price !== null && d.fee !== null) {
    payment.push([`Entrada · ${d.entryLabel}`, formatUYU(d.price)], ['Cargo por servicio', formatUYU(d.fee)]);
    total = ['Total pagado', formatUYU(d.total)];
  } else if (d.total > 0) {
    total = [`Entrada · ${d.entryLabel}`, formatUYU(d.total)];
  }

  const inner = `${heading(
    d.total === 0 ? 'INVITACIÓN' : 'COMPRA CONFIRMADA',
    `${d.firstName}, ya tenés tu entrada`,
    `Te esperamos el ${d.dateShort}. Mostrá este QR en puerta junto con tu cédula.`,
  )}
<tr><td style="padding-top:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:18px;">
<tr><td style="padding:20px 24px 0;font-size:13px;color:${C.soft};">${esc(d.eventTitle)} · ${esc(d.entryLabel)}</td>
<td align="right" style="padding:20px 24px 0;font-size:11px;font-weight:700;letter-spacing:2px;">VÁLIDA</td></tr>
<tr><td colspan="2" align="center" style="padding:18px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;"><tr><td style="padding:10px;">
<img src="cid:qr" width="200" height="200" alt="Código QR de la entrada" style="display:block;border:0;">
</td></tr></table>
</td></tr>
<tr><td colspan="2" align="center" style="padding:0 24px 22px;font-size:20px;font-weight:700;">${esc(d.fullName)}<br>
<span style="font-size:13px;font-weight:400;color:${C.soft};">${esc(ciMasked(d.docTail))}</span></td></tr>
</table>
</td></tr>
${button(d.ticketUrl, 'Ver mi entrada')}
<tr><td align="center" style="padding-top:10px;font-size:12px;color:${C.muted};">Desde ahí la podés guardar como imagen o PDF.</td></tr>
<tr><td style="padding-top:28px;">${rows([['Fecha', d.dateLong], ['Lugar', 'Se comparte el día del evento'], ...payment], total)}</td></tr>
<tr><td style="padding-top:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
<strong style="color:${C.bone};">Antes de ir</strong><br>La entrada es personal: en puerta te pedimos la cédula. No se venden entradas en puerta. La ubicación exacta la compartimos el día del evento por Instagram.
</td></tr></table></td></tr>`;

  const text = [
    `${d.firstName}, ya tenés tu entrada para ${d.eventTitle} (${d.dateLong}).`,
    `${d.entryLabel} · ${d.fullName} · ${ciMasked(d.docTail)}`,
    `Tu entrada con el QR: ${d.ticketUrl}`,
    d.total > 0 ? `Total pagado: ${formatUYU(d.total)}` : '',
    'La entrada es personal: en puerta te pedimos la cédula.',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html: layout(inner, `Tu entrada para el ${d.dateShort}: mostrá el QR en puerta.`), text };
}

// 5 · Entrada anulada por un admin (con reembolso si fue por Mercado Pago).
export function ticketCancelledEmail(d: TicketMailData & { refunded: boolean }) {
  const subject = `Tu entrada para ${d.eventTitle} fue anulada`;
  const refundBlock = d.refunded
    ? `<tr><td style="padding-top:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
<strong style="color:${C.bone};font-size:14px;">Te devolvimos ${esc(formatUYU(d.total))} por Mercado Pago</strong><br>La devolución va al mismo medio con el que pagaste. Según tu banco puede tardar unos días en verse.
</td></tr></table></td></tr>`
    : '';

  const inner = `${heading(
    'ANULADA',
    'Tu entrada fue anulada',
    'Revisamos las entradas de este evento y esta no cumple con nuestras condiciones de acceso, así que la anulamos. El QR ya no es válido en puerta.',
  )}
<tr><td style="padding-top:28px;">${rows([
    ['Evento', d.eventTitle],
    ['Entrada', d.entryLabel],
    ['A nombre de', `${d.fullName} · ${ciMasked(d.docTail)}`],
  ])}</td></tr>
${refundBlock}
<tr><td align="center" style="padding-top:24px;font-size:14px;line-height:1.55;color:${C.bone};">Si creés que es un error, escribinos por Instagram y lo revisamos.</td></tr>
${button(IG_URL, 'Escribinos por Instagram', true)}`;

  const text = [
    `Tu entrada para ${d.eventTitle} (${d.fullName}) fue anulada y el QR ya no es válido.`,
    d.refunded ? `Te devolvimos ${formatUYU(d.total)} por Mercado Pago.` : '',
    `Si creés que es un error, escribinos por Instagram: ${IG_URL}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html: layout(inner, 'Tu entrada fue anulada.'), text };
}
