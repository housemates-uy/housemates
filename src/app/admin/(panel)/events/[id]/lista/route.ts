import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/admin';
import { formatLocal } from '@/lib/events';
import { formatPhone } from '@/lib/tickets';
import { getDoorList } from './door-list';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'Nombre',
  'Cédula',
  'Email',
  'Celular',
  'Tanda',
  'Origen',
  'Estado',
  'Hora de ingreso',
];

// Excel en español separa con ";". Un valor que empieza con = + - @ lo tomaría como
// fórmula (y los nombres los escribe cualquiera): se le antepone un apóstrofo.
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse('No autorizado', { status: 401 });

  const list = await getDoorList(params.id);
  if (!list) return new NextResponse('Evento no encontrado', { status: 404 });

  const lines = [
    HEADERS,
    ...list.rows.map((r) => [
      r.name,
      r.document,
      r.email,
      formatPhone(r.phone),
      r.tier,
      r.origin,
      r.status,
      r.usedAt ? formatLocal(r.usedAt, 'dd/MM/yyyy HH:mm') : '',
    ]),
  ].map((values) => values.map(cell).join(';'));

  // BOM al principio: sin él, Excel abre el UTF-8 como Latin-1 y rompe las tildes.
  const csv = `﻿${lines.join('\r\n')}\r\n`;
  const filename = `lista-puerta-${list.event.slug}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
