// ============================================================
// Plantillas de mail con el branding de House Mates.
// Diseño aprobado en Claude Design ("Mails House Mates").
// ============================================================
// HTML de mail = tablas + estilos inline (Gmail, Outlook y Apple Mail ignoran casi todo lo
// demás). Fondo: los doodles desenfocados de la web (imagen), texto blanco.
//
// Modo oscuro de la app de Gmail (iOS/Android): invierte los COLORES de los mails (fondos y
// texto) pero no las IMÁGENES. Por eso:
//   - los fondos van como imagen (doodles) o background-image: linear-gradient(...), que
//     Gmail no invierte;
//   - el texto va envuelto en `blend()`: el truco "gmail-blend" (mix-blend-mode screen +
//     difference) que deshace la inversión y lo deja blanco;
//   - el QR (con su fondo blanco) y el logo (blanco, sobre los doodles) son imágenes: no se tocan;
//   - el fondo se repite en mosaico para cubrir todo el ancho en Gmail web;
//   - los botones son oscuros con borde blanco (un botón blanco con texto oscuro se rompe).
// Cada plantilla devuelve { subject, html, text }: el texto plano es para clientes que no
// muestran HTML y mejora la entrega (menos spam).
import { formatUYU } from '@/lib/events';
import { DEFAULT_IG_HANDLE, igUrl } from '@/lib/site';
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
const IG_URL = igUrl(DEFAULT_IG_HANDLE);

// Texto que Gmail no debe invertir. Solo para texto: aplicado a imágenes las invertiría.
function blend(html: string) {
  return `<div class="gmail-blend-screen"><div class="gmail-blend-difference">${html}</div></div>`;
}

// Fondo sólido que Gmail no invierte (lo trata como imagen).
const solid = (color: string) => `background-color:${color};background-image:linear-gradient(${color},${color});`;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// igHandle: el de site_config (getIgHandle() en src/lib/site.ts), que pasa quien manda el mail.
function layout(inner: string, preheader: string, igHandle = DEFAULT_IG_HANDLE) {
  const bg = `${appUrl()}/brand/mail-bg.jpg`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>House Mates</title>
<style>
u + .body .gmail-blend-screen { background:#000; mix-blend-mode:screen; }
u + .body .gmail-blend-difference { background:#000; mix-blend-mode:difference; }
</style></head>
<body class="body" style="margin:0;padding:0;${solid(C.ink)}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" background="${bg}" style="${solid(C.ink)}background-image:url('${bg}');background-repeat:repeat;background-position:center top;background-size:600px auto;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${FONT};color:${C.bone};">
<tr><td align="center" style="padding-bottom:32px;">
<img src="${appUrl()}/brand/logo-mail.png?v=3" width="120" height="120" alt="House Mates" style="display:block;border:0;">
</td></tr>
${inner}
<tr><td align="center" style="padding-top:36px;font-size:12px;line-height:1.6;color:${C.muted};">
${blend(`¿Dudas? Escribinos por Instagram <a href="${esc(igUrl(igHandle))}" style="color:${C.bone};">${esc(igHandle)}</a><br>House Mates · Uruguay`)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function heading(eyebrow: string, title: string, body: string) {
  return `<tr><td align="center" style="font-size:12px;font-weight:700;letter-spacing:3px;color:${C.soft};">${blend(esc(eyebrow))}</td></tr>
<tr><td align="center" style="padding-top:12px;font-size:30px;font-weight:700;line-height:1.15;color:${C.bone};">${blend(esc(title))}</td></tr>
<tr><td align="center" style="padding-top:12px;font-size:15px;line-height:1.55;color:${C.soft};">${blend(esc(body))}</td></tr>`;
}

function rows(items: [string, string][], totalRow?: [string, string]) {
  const r = items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:${C.soft};">${blend(esc(k))}</td><td align="right" style="padding:6px 0;font-size:14px;color:${C.bone};">${blend(esc(v))}</td></tr>`,
    )
    .join('');
  const t = totalRow
    ? `<tr><td style="padding:10px 0 0;border-top:1px solid ${C.line};font-size:15px;font-weight:700;">${blend(esc(totalRow[0]))}</td><td align="right" style="padding:10px 0 0;border-top:1px solid ${C.line};font-size:15px;font-weight:700;">${blend(esc(totalRow[1]))}</td></tr>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r}${t}</table>`;
}

// Botón oscuro con borde blanco: sobrevive a la inversión de Gmail (ver arriba).
function button(href: string, label: string) {
  return `<tr><td style="padding-top:24px;"><a href="${href}" style="display:block;${solid(C.ink)}border:1px solid ${C.bone};color:${C.bone};text-decoration:none;text-align:center;font-size:16px;font-weight:600;padding:16px;border-radius:10px;font-family:${FONT};">${blend(esc(label))}</a></td></tr>`;
}

export type TicketMailData = {
  firstName: string;
  fullName: string;
  document: string; // cédula parcial, p. ej. "•••• 298-0" (maskDocument)
  eventTitle: string;
  dateLong: string; // "Viernes 11 de diciembre · 23:00 hs"
  dateShort: string; // "11.12.26"
  entryLabel: string; // "Tanda 3" o "Cortesía"
  location: string | null; // nombre del lugar, como en el admin
  locationUrl: string | null; // pin de Google Maps
  ticketUrl: string;
  price: number | null; // precio de la entrada (compra web)
  discount: number; // descuento por código (0 si no hubo)
  discountCode: string | null;
  fee: number | null; // cargo por servicio (compra web con Mercado Pago; 0 en transferencia)
  total: number; // lo que pagó (0 en invitaciones)
  transport?: { name: string; departure: string; price: number } | null; // bus elegido al comprar
  entryUntil?: string | null; // tanda de ingreso temprano: "00:30"
  igHandle?: string;
  // Compra de varias entradas (§5.2e). boughtBy: quien la compró, si no es esta persona.
  // group: en los mails a quien compró, todas las entradas de la compra.
  boughtBy?: string | null;
  group?: { count: number; total: number; people: { name: string; total: number }[] } | null;
};

// Varias entradas: una fila por persona con lo que paga cada una, y el total de la compra.
function groupRows(d: TicketMailData, totalLabel: string) {
  if (!d.group || d.group.count < 2) return paymentRows(d, totalLabel);
  const payment = d.group.people.map((p): [string, string] => [`Entrada · ${p.name}`, formatUYU(p.total)]);
  return { payment, total: [totalLabel, formatUYU(d.group.total)] as [string, string] };
}

const groupNames = (d: TicketMailData) => (d.group?.people ?? []).map((p) => p.name).join(', ');

// Tanda de ingreso temprano: fila "Ingreso · Hasta las 00:30".
const entryRows = (d: TicketMailData): [string, string][] =>
  d.entryUntil ? [['Ingreso', `Hasta las ${d.entryUntil}`]] : [];

// Desglose del pago: entrada, descuento (si hubo), cargo por servicio (si hubo) y total.
function paymentRows(d: TicketMailData, totalLabel: string) {
  const payment: [string, string][] = [];
  let total: [string, string] | undefined;
  if (d.price !== null && d.fee !== null) {
    payment.push([`Entrada · ${d.entryLabel}`, formatUYU(d.price)]);
    if (d.discount > 0) {
      payment.push([`Descuento${d.discountCode ? ` (${d.discountCode})` : ''}`, `−${formatUYU(d.discount)}`]);
    }
    if (d.transport) payment.push([`Transporte · ${d.transport.name}`, formatUYU(d.transport.price)]);
    if (d.fee > 0) payment.push(['Cargo por servicio', formatUYU(d.fee)]);
    total = [totalLabel, formatUYU(d.total)];
  } else if (d.total > 0) {
    total = [d.transport ? totalLabel : `Entrada · ${d.entryLabel}`, formatUYU(d.total)];
  }
  return { payment, total };
}

// Punto y horario del bus, si lo eligió al comprar.
function busPanel(d: TicketMailData) {
  if (!d.transport) return '';
  return `<tr><td style="padding-top:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
${blend(`<strong style="color:${C.bone};">Tu lugar en el bus · ${esc(d.transport.name)}</strong><br>${esc(d.transport.departure).replace(/\n/g, '<br>')}`)}
</td></tr></table></td></tr>`;
}

const busText = (d: TicketMailData) =>
  d.transport ? `Transporte: ${d.transport.name} · ${d.transport.departure.replace(/\s*\n\s*/g, ' · ')}` : '';

// Cédula parcial: un mail se reenvía. Con espacio de no corte: en pantallas angostas no se parte.
const ciText = (document: string) => `CI ${document}`;

// Para los mails de comunicación del evento (src/lib/mail/event-mails.ts).
export { C as MAIL_COLORS, IG_URL, blend, solid, esc, layout, heading, rows, button, ciText };

// 1 · Entrada confirmada: compra web aprobada, entrada manual o invitación.
// El QR va como imagen adjunta embebida (cid:qr) porque Gmail no muestra imágenes data:.
export function ticketConfirmedEmail(d: TicketMailData) {
  const subject = `Tu entrada para ${d.eventTitle} · ${d.dateShort}`;
  // Quien compró para varios ve lo que pagó por todas (una fila por persona y el total).
  const { payment, total } = d.boughtBy ? { payment: [], total: undefined } : groupRows(d, 'Total pagado');

  // heading() ya escapa: el nombre va sin esc() acá.
  const inner = `${heading(
    d.total === 0 ? 'CORTESÍA' : d.boughtBy ? 'TE COMPRARON TU ENTRADA' : 'COMPRA CONFIRMADA',
    `${d.firstName}, ya tenés tu entrada`,
    `${d.boughtBy ? `${d.boughtBy} te compró tu entrada. ` : ''}Te esperamos el ${d.dateShort}. Mostrá este QR en puerta junto con tu cédula.`,
  )}
<tr><td style="padding-top:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.ink)}border:1px solid ${C.line};border-radius:18px;">
<tr><td style="padding:20px 24px 0;font-size:13px;color:${C.soft};">${blend(`${esc(d.eventTitle)} · ${esc(d.entryLabel)}`)}</td>
<td align="right" style="padding:20px 24px 0;font-size:11px;font-weight:700;letter-spacing:2px;">${blend('VÁLIDA')}</td></tr>
<tr><td colspan="2" align="center" style="padding:18px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;"><tr><td style="padding:10px;">
<img src="cid:qr" width="200" height="200" alt="Código QR de la entrada" style="display:block;border:0;">
</td></tr></table>
</td></tr>
<tr><td colspan="2" align="center" style="padding:0 24px 22px;font-size:20px;font-weight:700;">${blend(`${esc(d.fullName)}<br>
<span style="font-size:13px;font-weight:400;color:${C.soft};">${esc(ciText(d.document))}</span>`)}</td></tr>
</table>
</td></tr>
${button(d.ticketUrl, 'Ver mi entrada')}
<tr><td align="center" style="padding-top:10px;font-size:12px;color:${C.muted};">${blend('Desde ahí la podés guardar como imagen o PDF.')}</td></tr>
<tr><td style="padding-top:28px;">${rows([['Fecha', d.dateLong], ...entryRows(d), ['Lugar', d.location ?? 'A confirmar'], ...payment], total)}</td></tr>
${busPanel(d)}
<tr><td style="padding-top:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
${blend(`<strong style="color:${C.bone};">Antes de ir</strong><br>La entrada es personal: en puerta te pedimos la cédula. No se venden entradas en puerta.${
    d.entryUntil ? `<br>Tu tanda es de ingreso temprano: entrá antes de las ${esc(d.entryUntil)}.` : ''
  }${
    d.locationUrl
      ? `<br><a href="${esc(d.locationUrl)}" style="color:${C.bone};text-decoration:underline;">Cómo llegar: ver en Google Maps</a>`
      : ''
  }`)}
</td></tr></table></td></tr>`;

  const text = [
    `${d.firstName}, ya tenés tu entrada para ${d.eventTitle} (${d.dateLong}).`,
    d.boughtBy ? `Te la compró ${d.boughtBy}.` : '',
    `${d.entryLabel} · ${d.fullName} · ${ciText(d.document)}`,
    d.entryUntil ? `Ingreso temprano: entrá antes de las ${d.entryUntil}.` : '',
    `Tu entrada con el QR: ${d.ticketUrl}`,
    d.location ? `Lugar: ${d.location}${d.locationUrl ? ` (${d.locationUrl})` : ''}` : '',
    d.total > 0 && !d.boughtBy
      ? `Total pagado: ${formatUYU(d.group && d.group.count > 1 ? d.group.total : d.total)}`
      : '',
    busText(d),
    'La entrada es personal: en puerta te pedimos la cédula.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    html: layout(inner, `Tu entrada para el ${d.dateShort}: mostrá el QR en puerta.`, d.igHandle),
    text,
  };
}

// 5 · Entrada anulada por un admin (con reembolso si fue por Mercado Pago). Texto neutro: se
// anula también por arrepentimiento o porque se canceló la fecha.
export function ticketCancelledEmail(d: TicketMailData & { refunded: boolean }) {
  const subject = `Tu entrada para ${d.eventTitle} fue anulada`;
  const ig = igUrl(d.igHandle ?? DEFAULT_IG_HANDLE);
  const refundBlock = d.refunded
    ? `<tr><td style="padding-top:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
${blend(
  d.boughtBy
    ? `<strong style="color:${C.bone};font-size:14px;">Se devolvieron ${esc(formatUYU(d.total))} por Mercado Pago</strong><br>La devolución va al medio con el que se pagó la compra, a ${esc(d.boughtBy)}, que la hizo.`
    : `<strong style="color:${C.bone};font-size:14px;">Te devolvimos ${esc(formatUYU(d.total))} por Mercado Pago</strong><br>La devolución va al mismo medio con el que pagaste. Según tu banco puede tardar unos días en verse.`,
)}
</td></tr></table></td></tr>`
    : '';

  const inner = `${heading(
    'ANULADA',
    'Tu entrada fue anulada',
    'Tu entrada fue anulada y el QR ya no es válido.',
  )}
<tr><td style="padding-top:28px;">${rows([
    ['Evento', d.eventTitle],
    ['Entrada', d.entryLabel],
    ['A nombre de', `${d.fullName} · ${ciText(d.document)}`],
  ])}</td></tr>
${refundBlock}
<tr><td align="center" style="padding-top:24px;font-size:14px;line-height:1.55;color:${C.bone};">${blend('Si tenés dudas o creés que es un error, escribinos por Instagram.')}</td></tr>
${button(ig, 'Escribinos por Instagram')}`;

  const text = [
    `Tu entrada para ${d.eventTitle} (${d.fullName}) fue anulada y el QR ya no es válido.`,
    d.refunded
      ? d.boughtBy
        ? `Se devolvieron ${formatUYU(d.total)} por Mercado Pago al medio con el que se pagó la compra (la hizo ${d.boughtBy}).`
        : `Te devolvimos ${formatUYU(d.total)} por Mercado Pago. Va al mismo medio con el que pagaste y, según tu banco, puede tardar unos días en verse.`
      : '',
    `Si tenés dudas o creés que es un error, escribinos por Instagram: ${ig}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html: layout(inner, 'Tu entrada fue anulada.', d.igHandle), text };
}

// 2 · Transferencia recibida: la persona subió el comprobante y queda en revisión.
export function transferReceivedEmail(d: TicketMailData) {
  const subject = `Recibimos tu comprobante · ${d.eventTitle} ${d.dateShort}`;
  const several = !!d.group && d.group.count > 1;
  const { payment, total } = groupRows(d, 'Total transferido');
  const inner = `${heading(
    'TRANSFERENCIA RECIBIDA',
    `${d.firstName}, recibimos tu comprobante`,
    several
      ? `Lo estamos validando. Cuando confirmemos la transferencia, a cada uno le llega su entrada con el QR a su mail.`
      : 'Lo estamos validando. Cuando confirmemos la transferencia te mandamos la entrada con el QR a este mail.',
  )}
<tr><td style="padding-top:28px;">${rows([['Fecha', d.dateLong], ['Lugar', d.location ?? 'A confirmar'], ...(several ? [] : ([['A nombre de', `${d.fullName} · ${ciText(d.document)}`]] as [string, string][])), ...payment], total)}</td></tr>
${busPanel(d)}
<tr><td style="padding-top:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
${blend(`<strong style="color:${C.bone};">${several ? 'Los lugares quedan reservados' : 'Tu lugar queda reservado'}</strong><br>Mientras validamos el comprobante nadie más puede usar ${several ? 'esos lugares' : 'tu lugar'}. Si algo no coincide te escribimos.`)}
</td></tr></table></td></tr>`;

  const text = [
    `${d.firstName}, recibimos tu comprobante para ${d.eventTitle} (${d.dateLong}).`,
    several
      ? `Lo estamos validando. Cuando confirmemos la transferencia, a cada uno le llega su entrada a su mail (${groupNames(d)}).`
      : 'Lo estamos validando. Cuando confirmemos la transferencia te mandamos la entrada con el QR a este mail.',
    `Total transferido: ${formatUYU(several ? d.group!.total : d.total)}`,
    busText(d),
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html: layout(inner, 'Estamos validando tu transferencia.', d.igHandle), text };
}

// 3 · Transferencia rechazada. Los motivos son los de Preguntas frecuentes ("Me rechazaron la
// transferencia").
export function transferRejectedEmail(d: TicketMailData) {
  const subject = `No pudimos validar tu transferencia · ${d.eventTitle}`;
  const ig = igUrl(d.igHandle ?? DEFAULT_IG_HANDLE);
  const inner = `${heading(
    'NO PUDIMOS VALIDARLA',
    'Tu transferencia no se pudo validar',
    'Revisamos tu comprobante y no pudimos validar la transferencia: puede ser que el monto no coincida con el total, que el comprobante no se lea o que no la encontremos en la cuenta. La reserva se anuló y el lugar se liberó.',
  )}
<tr><td style="padding-top:28px;">${rows([
    ['Evento', d.eventTitle],
    ['Entrada', d.entryLabel],
    d.group && d.group.count > 1
      ? ['Entradas', `${d.group.count} · ${groupNames(d)}`]
      : ['A nombre de', `${d.fullName} · ${ciText(d.document)}`],
  ])}</td></tr>
<tr><td align="center" style="padding-top:24px;font-size:14px;line-height:1.55;color:${C.bone};">${blend('Si ya transferiste, escribinos por Instagram con el comprobante y lo revisamos. Si la plata llegó, te la devolvemos.')}</td></tr>
${button(ig, 'Escribinos por Instagram')}`;

  const text = [
    `No pudimos validar tu transferencia para ${d.eventTitle} (${d.fullName}) y la reserva se anuló.`,
    'Puede ser que el monto no coincida con el total, que el comprobante no se lea o que no encontremos la transferencia en la cuenta.',
    `Si ya transferiste, escribinos por Instagram con el comprobante: ${ig}. Si la plata llegó, te la devolvemos.`,
  ].join('\n');

  return { subject, html: layout(inner, 'Tu transferencia no se pudo validar.', d.igHandle), text };
}

// 4 · Aviso a los owners: hay una transferencia para validar (con el comprobante adjunto).
export function transferAdminAlertEmail(d: TicketMailData & { adminUrl: string; instagram: string | null }) {
  const several = !!d.group && d.group.count > 1;
  const toReceive = several ? d.group!.total : d.total;
  const subject = `Transferencia para validar: ${d.fullName}${several ? ` (${d.group!.count} entradas)` : ''} · ${formatUYU(toReceive)}`;
  const inner = `${heading(
    'PARA VALIDAR',
    'Hay una transferencia nueva',
    `${d.fullName} subió el comprobante${several ? ` de ${d.group!.count} entradas` : ''}. Fijate que la plata haya llegado y aprobá o rechazá ${several ? 'la compra' : 'la entrada'}.`,
  )}
<tr><td style="padding-top:28px;">${rows([
    ['Comprador', d.fullName],
    ['Instagram', d.instagram ? `@${d.instagram}` : '—'],
    ['Entrada', d.entryLabel],
    ...(d.discount > 0 ? ([[`Descuento${d.discountCode ? ` (${d.discountCode})` : ''}`, `−${formatUYU(d.discount)}`]] as [string, string][]) : []),
    ...(several
      ? d.group!.people.map((p): [string, string] => [`Entrada · ${p.name}`, formatUYU(p.total)])
      : d.transport
        ? ([[`Transporte · ${d.transport.name}`, formatUYU(d.transport.price)]] as [string, string][])
        : []),
  ], ['Total a recibir', formatUYU(toReceive)])}</td></tr>
${button(d.adminUrl, 'Validar en el admin')}
<tr><td align="center" style="padding-top:10px;font-size:12px;color:${C.muted};">${blend('El comprobante va adjunto a este mail.')}</td></tr>`;

  const text = [
    `Transferencia para validar: ${d.fullName} (${d.entryLabel}${several ? `, ${d.group!.count} entradas: ${groupNames(d)}` : ''}), ${formatUYU(toReceive)}.`,
    `Validala en: ${d.adminUrl}`,
  ].join('\n');

  return { subject, html: layout(inner, `${d.fullName} subió un comprobante.`, d.igHandle), text };
}

// 5 · Cuenta de comprador: confirmar el email. Hasta confirmarlo, "Mi cuenta" muestra solo
// las entradas compradas desde la cuenta (ver docs/LOGICA_DE_NEGOCIO.md → "Cuentas").
export function accountConfirmEmail(d: { firstName: string; url: string; igHandle?: string }) {
  const subject = 'Confirmá tu email · House Mates';
  const inner = `${heading(
    'TU CUENTA',
    `${d.firstName}, confirmá tu email`,
    'Tocá el botón y elegí tu contraseña: así en Mi cuenta aparecen todas las entradas a tu nombre, también las que te mandaron a este mail.',
  )}
${button(d.url, 'Confirmar mi email')}
<tr><td align="center" style="padding-top:14px;font-size:12px;line-height:1.6;color:${C.muted};">${blend('El link vence en 1 hora. Si se te vence, pedí otro desde Mi cuenta.<br>Si no creaste una cuenta en House Mates, ignorá este mail.')}</td></tr>`;

  const text = [
    `${d.firstName}, confirmá tu email y elegí tu contraseña para ver todas tus entradas en Mi cuenta:`,
    d.url,
    'El link vence en 1 hora. Si no creaste una cuenta en House Mates, ignorá este mail.',
  ].join('\n');

  return { subject, html: layout(inner, 'Confirmá tu email para ver tus entradas.', d.igHandle), text };
}

// 6 · Cuenta de comprador: elegir una contraseña nueva.
export function passwordResetEmail(d: { url: string; igHandle?: string }) {
  const subject = 'Elegí una contraseña nueva · House Mates';
  const inner = `${heading(
    'TU CUENTA',
    'Elegí una contraseña nueva',
    'Pediste recuperar el acceso a tu cuenta. Tocá el botón y elegí una contraseña nueva.',
  )}
${button(d.url, 'Elegir contraseña')}
<tr><td align="center" style="padding-top:14px;font-size:12px;line-height:1.6;color:${C.muted};">${blend('El link vence en 1 hora y sirve una sola vez.<br>Si no lo pediste, ignorá este mail: tu contraseña no cambia.')}</td></tr>`;

  const text = [
    'Pediste recuperar el acceso a tu cuenta de House Mates. Elegí una contraseña nueva acá:',
    d.url,
    'El link vence en 1 hora. Si no lo pediste, ignorá este mail.',
  ].join('\n');

  return { subject, html: layout(inner, 'Elegí una contraseña nueva.', d.igHandle), text };
}

export type BarOrderMailData = {
  firstName: string | null;
  eventTitle: string;
  dateShort: string;
  orderUrl: string;
  lines: { name: string; quantity: number; price: number }[];
  units: { name: string; cid: string }[]; // un QR por trago, en el orden del pedido
  total: number;
  igHandle?: string;
};

// 7 · Pedido de barra pago: un QR por trago, cada uno con su nombre, de a dos por fila.
// Cada QR va como imagen adjunta embebida (cid:qr1, cid:qr2…), igual que el de la entrada.
export function barOrderEmail(d: BarOrderMailData) {
  const subject = `Tu pedido de barra · ${d.eventTitle} ${d.dateShort}`;
  const n = d.units.length;
  const cells = d.units.map(
    (u, i) => `<td width="50%" valign="top" style="padding:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.ink)}border:1px solid ${C.line};border-radius:14px;">
<tr><td align="center" style="padding:14px 10px 0;font-size:14px;font-weight:700;line-height:1.3;color:${C.bone};">${blend(esc(u.name))}</td></tr>
<tr><td align="center" style="padding:4px 10px 0;font-size:11px;letter-spacing:1px;color:${C.muted};">${blend(`TRAGO ${i + 1} DE ${n}`)}</td></tr>
<tr><td align="center" style="padding:12px 10px 14px;"><table role="presentation" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:10px;"><tr><td style="padding:8px;">
<img src="cid:${u.cid}" width="150" height="150" alt="QR de ${esc(u.name)}" style="display:block;border:0;width:150px;max-width:100%;height:auto;">
</td></tr></table></td></tr>
</table></td>`,
  );
  const grid: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    grid.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%" style="padding:6px;"></td>'}</tr>`);
  }

  const inner = `${heading(
    'PEDIDO DE BARRA',
    d.firstName ? `${d.firstName}, tus tragos están pagos` : 'Tus tragos están pagos',
    'Cada QR vale un trago. Mostralo en la barra y retiralo cuando quieras, de a uno o todos juntos.',
  )}
<tr><td style="padding-top:22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${grid.join('')}</table></td></tr>
${button(d.orderUrl, 'Ver mi pedido')}
<tr><td align="center" style="padding-top:10px;font-size:12px;color:${C.muted};">${blend('Desde ahí ves qué te falta retirar: se actualiza sola.')}</td></tr>
<tr><td style="padding-top:28px;">${rows(
    d.lines.map((l) => [`${l.quantity} × ${l.name}`, formatUYU(l.quantity * l.price)] as [string, string]),
    ['Total pagado', formatUYU(d.total)],
  )}</td></tr>
<tr><td style="padding-top:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${solid(C.panel)}border-radius:14px;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.6;color:${C.soft};">
${blend(`<strong style="color:${C.bone};">Cómo funciona</strong><br>El barman escanea cada QR una sola vez. Si querés invitarle un trago a alguien, mandale ese QR. Valen solo para ${esc(d.eventTitle)} del ${esc(d.dateShort)}.`)}
</td></tr></table></td></tr>`;

  const text = [
    `${d.firstName ? `${d.firstName}, tus` : 'Tus'} tragos para ${d.eventTitle} (${d.dateShort}) están pagos.`,
    ...d.lines.map((l) => `${l.quantity} × ${l.name}`),
    `Total pagado: ${formatUYU(d.total)}`,
    `Tus QRs (uno por trago): ${d.orderUrl}`,
    'Mostrá cada QR en la barra: vale un trago y se usa una sola vez.',
  ].join('\n');

  return {
    subject,
    html: layout(inner, `Tenés ${n} ${n === 1 ? 'trago' : 'tragos'} para retirar en la barra.`, d.igHandle),
    text,
  };
}
