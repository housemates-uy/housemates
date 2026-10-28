import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/card';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';

export const metadata = { title: 'Historial' };

const LIMIT = 200;

// Las acciones se guardan con un código en inglés (admin_logs.action); acá, en castellano.
const ACTIONS: Record<string, string> = {
  create: 'Creó',
  update: 'Editó',
  archive: 'Archivó',
  enable_sales: 'Activó las ventas',
  disable_sales: 'Pausó las ventas',
  activate_tier: 'Activó la tanda',
  deactivate_tier: 'Desactivó la tanda',
  soldout_tier: 'Agotó a mano la tanda',
  restore_tier: 'Restauró la tanda',
  send_presale: 'Mandó la preventa',
  send_reminder: 'Mandó el recordatorio',
  send_survey: 'Mandó la encuesta',
  update_arrival_info: 'Editó "Cómo llegar"',
  create_manual_ticket: 'Cargó una entrada manual',
  create_invitation: 'Cargó una invitación',
  cancel_ticket: 'Anuló la entrada',
  refund_ticket: 'Reembolsó la entrada',
  resend_ticket_mail: 'Reenvió el mail de la entrada',
  approve_transfer: 'Aprobó la transferencia',
  reject_transfer: 'Rechazó la transferencia',
  create_discount_code: 'Creó el código de descuento',
  enable_discount_code: 'Activó el código de descuento',
  disable_discount_code: 'Pausó el código de descuento',
  create_bar_product: 'Agregó el trago',
  update_bar_product: 'Editó el trago',
  enable_bar_product: 'Activó el trago',
  disable_bar_product: 'Desactivó el trago',
  reorder_bar_product: 'Reordenó la carta',
  pause_bar: 'Pausó la barra',
  resume_bar: 'Reabrió la barra',
  create_transport_option: 'Agregó la opción de transporte',
  update_transport_option: 'Editó la opción de transporte',
  enable_transport_option: 'Activó la opción de transporte',
  disable_transport_option: 'Desactivó la opción de transporte',
  delete_transport_option: 'Borró la opción de transporte',
  close_door: 'Cerró la puerta',
  open_door: 'Abrió la puerta',
};

const ENTITIES: Record<string, string> = {
  event: 'evento',
  tier: 'tanda',
  ticket: 'entrada',
  site_config: 'configuración',
  discount_code: 'código',
  bar_product: 'trago',
  transport_option: 'transporte',
};

const FIELDS: Record<string, string> = {
  title: 'Título',
  slug: 'Slug',
  date_start: 'Inicio',
  date_end: 'Fin',
  location_name: 'Lugar',
  location_url: 'URL del lugar',
  capacity: 'Capacidad',
  status: 'Estado',
  description_md: 'Descripción',
  description: 'Descripción',
  sales_active: 'Ventas activas',
  name: 'Nombre',
  price_uyu: 'Precio',
  quantity_total: 'Cupo',
  active: 'Activa',
  entry_until: 'Ingreso hasta',
  sales_start: 'Sale a la venta',
  presale_code: 'Código de preventa',
  gate_enabled: 'Pedir contraseña para comprar',
  pay_mp_enabled: 'Mercado Pago',
  pay_transfer_enabled: 'Transferencia',
  transfer_details: 'Datos para transferir',
  new_tiers: 'Tandas nuevas',
  tiers: 'Tandas',
  sent: 'Enviados',
  failed: 'Fallaron',
  skipped: 'Ya los mandaba otro envío',
  left: 'Quedan',
  resend_all: 'Reenvío a todos',
  already_refunded_in_mp: 'Ya figuraba devuelto en Mercado Pago',
  result: 'Resultado',
};

const STATUS_VALUES: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

// Qué fue lo que se tocó: el nombre del evento, de la tanda o de quién es la entrada.
type Names = Map<string, string>;

function formatValue(field: string, value: Json | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.map((v) => formatValue(field, v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  if (['gate_enabled', 'pay_mp_enabled', 'pay_transfer_enabled'].includes(field)) {
    return text === '1' ? 'Sí' : text === '0' ? 'No' : text;
  }
  if (field === 'status') return STATUS_VALUES[text] ?? text;
  if (field === 'price_uyu') return `$${Number(text).toLocaleString('es-UY')}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return formatLocal(text, "d/MM/yyyy HH:mm");
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) return text.slice(0, 5);
  return text;
}

// Detalle legible: los cambios como "Campo: antes → después" y el resto como "Campo: valor".
function DiffDetail({ diff }: { diff: Json | null }) {
  if (!diff || typeof diff !== 'object' || Array.isArray(diff)) return null;
  const { changes, ...rest } = diff as Record<string, Json>;
  const changeList =
    changes && typeof changes === 'object' && !Array.isArray(changes)
      ? Object.entries(changes as Record<string, { from?: Json; to?: Json }>)
      : [];
  const restList = Object.entries(rest).filter(([, v]) => v !== null && v !== undefined);
  if (changeList.length === 0 && restList.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-0.5 text-xs text-bone/60">
      {changeList.map(([field, c]) => (
        <li key={field} className="whitespace-pre-line break-words">
          <span className="text-bone/45">{FIELDS[field] ?? field}:</span> {formatValue(field, c?.from)}{' '}
          <span aria-label="cambió a">→</span> <span className="text-bone/85">{formatValue(field, c?.to)}</span>
        </li>
      ))}
      {restList.map(([field, value]) => (
        <li key={field} className="whitespace-pre-line break-words">
          <span className="text-bone/45">{FIELDS[field] ?? field}:</span> {formatValue(field, value)}
        </li>
      ))}
    </ul>
  );
}

async function entityNames(rows: { entity_type: string; entity_id: string | null }[]): Promise<Names> {
  const db = createAdminClient();
  const ids = (type: string) =>
    Array.from(new Set(rows.filter((r) => r.entity_type === type && r.entity_id).map((r) => r.entity_id!)));
  const [events, tiers, tickets, codes, products, options] = await Promise.all([
    ids('event').length ? db.from('events').select('id, title').in('id', ids('event')) : null,
    ids('tier').length ? db.from('ticket_tiers').select('id, name, events(title)').in('id', ids('tier')) : null,
    ids('ticket').length ? db.from('tickets').select('id, buyer_name, events(title)').in('id', ids('ticket')) : null,
    ids('discount_code').length ? db.from('discount_codes').select('id, code').in('id', ids('discount_code')) : null,
    ids('bar_product').length ? db.from('bar_products').select('id, name').in('id', ids('bar_product')) : null,
    ids('transport_option').length
      ? db.from('transport_options').select('id, name').in('id', ids('transport_option'))
      : null,
  ]);
  const names: Names = new Map();
  const eventTitle = (e: unknown) => (e as { title?: string } | null)?.title;
  for (const e of events?.data ?? []) names.set(e.id, e.title);
  for (const t of tiers?.data ?? []) names.set(t.id, [t.name, eventTitle(t.events)].filter(Boolean).join(' · '));
  for (const t of tickets?.data ?? []) names.set(t.id, [t.buyer_name, eventTitle(t.events)].filter(Boolean).join(' · '));
  for (const c of codes?.data ?? []) names.set(c.id, c.code);
  for (const p of products?.data ?? []) names.set(p.id, p.name);
  for (const o of options?.data ?? []) names.set(o.id, o.name);
  return names;
}

function describe(row: { action: string; entity_type: string; entity_id: string | null }, names: Names): string {
  if (row.entity_type === 'site_config') {
    if (row.action === 'update_gate_password') return 'Cambió la contraseña de compra';
    return row.action === 'update_sale_config' ? 'Editó la configuración de la venta' : 'Editó la configuración';
  }
  const verb = ACTIONS[row.action] ?? row.action;
  const entity = ENTITIES[row.entity_type] ?? row.entity_type;
  const name = row.entity_id ? names.get(row.entity_id) : undefined;
  // "Creó" y "Editó" no dicen qué: se les suma el tipo ("Editó el evento").
  const needsEntity = row.action === 'create' || row.action === 'update';
  const article = row.entity_type === 'tier' || row.entity_type === 'ticket' || row.entity_type === 'site_config' ? 'la' : 'el';
  const base = needsEntity ? `${verb} ${article} ${entity}` : verb;
  return name ? `${base}: ${name}` : base;
}

// Historial de acciones del panel (solo owners): las últimas 200, la más nueva primero.
export default async function LogsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');
  if (admin.role !== 'owner') redirect('/admin');

  const { data, error } = await createAdminClient()
    .from('admin_logs')
    .select('id, action, entity_type, entity_id, diff, created_at, admins(name, email)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  const rows = data ?? [];
  const names = await entityNames(rows);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Historial de acciones"
        description={`Lo que se hizo desde el panel, la más nueva primero. Se muestran las últimas ${LIMIT}. Hora de Montevideo.`}
      />
      {rows.length === 0 ? (
        <EmptyState title="Todavía no hay acciones registradas" />
      ) : (
        <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
          {rows.map((r) => {
            const who = r.admins as unknown as { name: string | null; email: string } | null;
            return (
              <li key={r.id} className="grid gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[9.5rem_1fr]">
                <p className="text-xs tabular-nums text-bone/50">
                  <time dateTime={r.created_at}>{formatLocal(r.created_at, "d/MM/yyyy HH:mm")}</time>
                </p>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{who?.name || who?.email || 'Admin borrado'}</span>{' '}
                    <span className="text-bone/80">· {describe(r, names)}</span>
                  </p>
                  <DiffDetail diff={r.diff} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
