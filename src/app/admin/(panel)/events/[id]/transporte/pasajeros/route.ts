import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/admin';
import { formatPhone } from '@/lib/tickets';
import { getPassengers } from '../passengers';

export const dynamic = 'force-dynamic';

const HEADERS = ['Opción', 'Salida', 'Nombre', 'Cédula', 'Celular', 'Email', 'Estado'];

// Igual que la lista de puerta: Excel en español separa con ";" y un valor que empieza con
// = + - @ lo tomaría como fórmula (los nombres los escribe cualquiera).
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Pasajeros con la entrada válida (paga o usada), de todas las opciones o de una (?opcion=<id>).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse('No autorizado', { status: 401 });

  const data = await getPassengers(params.id);
  if (!data) return new NextResponse('Evento no encontrado', { status: 404 });

  const only = new URL(request.url).searchParams.get('opcion');
  const options = only ? data.options.filter((o) => o.id === only) : data.options;

  const lines = [
    HEADERS,
    ...options.flatMap((o) =>
      o.confirmed.map((p) => [o.name, o.departure.replace(/\s*\n\s*/g, ' · '), p.name, p.document, formatPhone(p.phone), p.email, p.statusLabel]),
    ),
  ].map((values) => values.map(cell).join(';'));

  // BOM al principio: sin él, Excel abre el UTF-8 como Latin-1 y rompe las tildes.
  const csv = `﻿${lines.join('\r\n')}\r\n`;
  const suffix = only && options[0] ? `-${slugify(options[0].name)}` : '';
  const filename = `pasajeros-bus-${data.event.slug}${suffix}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
