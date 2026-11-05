import { NextResponse } from 'next/server';
import { getAdminUser, logAdminAction } from '@/lib/auth/admin';
import { formatLocal } from '@/lib/events';
import { getBuyers } from '../buyers';

export const dynamic = 'force-dynamic';

const HEADERS = ['email', 'nombre', 'ultima_fiesta', 'fiestas'];

// Igual que la lista de puerta: Excel en español separa con ";" y un valor que empieza con
// = + - @ lo tomaría como fórmula (los nombres los escribe cualquiera): va con un apóstrofo.
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Base de compradores para mailing (ADR #038), sin las bajas. Solo owners: son los datos de
// todos los que compraron (ni staff ni ningún otro rol). Cada descarga queda en el Historial.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse('No autorizado', { status: 401 });
  if (admin.role !== 'owner') return new NextResponse('Solo para owners', { status: 403 });

  const buyers = await getBuyers();
  const listed = buyers.filter((b) => !b.unsubscribed);

  const lines = [
    HEADERS,
    ...listed.map((b) => [
      b.email,
      b.name,
      `${b.lastEvent.title} (${formatLocal(b.lastEvent.date, 'dd/MM/yyyy')})`,
      String(b.events),
    ]),
  ].map((values) => values.map(cell).join(';'));

  // BOM al principio: sin él, Excel abre el UTF-8 como Latin-1 y rompe las tildes.
  const csv = `﻿${lines.join('\r\n')}\r\n`;
  const filename = `compradores-${formatLocal(new Date().toISOString(), 'yyyy-MM-dd')}.csv`;

  await logAdminAction(admin.id, 'download_buyers_csv', 'buyers', undefined, {
    emails: listed.length,
    unsubscribed: buyers.length - listed.length,
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
