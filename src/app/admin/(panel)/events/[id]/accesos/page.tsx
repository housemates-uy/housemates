import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { ContextMenu, ContextMenuButton } from '@/components/admin/context-menu';
import { SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/card';
import {
  ACCESS_KIND_LABELS,
  accessLink,
  formatAccessCode,
  normalizeAccessCode,
  parseAccessKind,
  type AccessCodeKind,
} from '@/lib/access-codes';
import { formatLocal } from '@/lib/events';
import { createAdminClient, fetchAll } from '@/lib/supabase/admin';
import { formatDocument, STATUS_LABELS } from '@/lib/tickets';
import type { TicketStatus } from '@/types/database';
import { deleteAccessCodeAction, toggleAccessCodeAction } from './actions';
import { NewAccessForm } from './new-access-form';
import { ShareButtons } from './share-buttons';

export const metadata = { title: 'Accesos' };

const STATUS_TONE: Record<TicketStatus, 'solid' | 'neutral' | 'alert' | 'club'> = {
  paid: 'solid',
  used: 'club',
  pending: 'neutral',
  review: 'alert',
  cancelled: 'neutral',
  refunded: 'neutral',
};

type AccessCode = { code: string; kind: AccessCodeKind; max_uses: number | null; valid_until: string | null };

const entries = (n: number) => (n === 1 ? '1 entrada' : `${n} entradas`);

// Qué permite el código, en una frase: "Sirve para 4 entradas" o, el público, "Cada compra
// lleva 1 entrada, hasta 50 en total".
function describeCode(c: AccessCode): string {
  if (c.kind === 'personal') return `Sirve para ${entries(c.max_uses ?? 1)}`;
  return `Cada compra lleva 1 entrada, ${c.max_uses === null ? 'sin tope' : `hasta ${entries(c.max_uses)} en total`}`;
}

function whatsappHref(c: AccessCode, eventTitle: string): string {
  const many = c.kind === 'personal' && (c.max_uses ?? 1) > 1;
  const lines = [
    `¡Hola! Este es tu código para comprar ${many ? 'las entradas' : 'tu entrada'} de ${eventTitle}: ${formatAccessCode(c.code)}`,
    ...(many ? [`Sirve para ${c.max_uses} entradas, cada una con el nombre y la cédula de quien va.`] : []),
    ...(c.kind === 'public' ? ['Es para una entrada por compra: si vienen amigos, cada uno saca la suya.'] : []),
    ...(c.valid_until ? [`Vale hasta el ${formatLocal(c.valid_until, "d/MM 'a las' HH:mm")}.`] : []),
    `Entrá acá: ${accessLink(c.code)}`,
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

// Códigos de acceso del evento (solo owners): a quien escribe por Instagram se le pasa un
// código personal para X entradas, y para una historia, uno público (una entrada por compra).
// Cada entrada que se compra con un código gasta un uso y queda marcada.
export default async function AccessCodesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { creado?: string };
}) {
  const admin = await requireAdmin();
  if (admin.role !== 'owner') redirect(`/admin/events/${params.id}`);
  const db = createAdminClient();
  const now = new Date().toISOString();

  const [{ data: event }, { data: codes, error }] = await Promise.all([
    db.from('events').select('title').eq('id', params.id).single(),
    db
      .from('access_codes')
      .select('id, code, label, kind, max_uses, valid_until, active')
      .eq('event_id', params.id)
      .order('created_at', { ascending: false }),
  ]);
  if (error) throw error;
  const ids = codes.map((c) => c.id);

  // Entradas compradas con cada código, sin las compras abandonadas (reserva vencida). `referenced`:
  // alguna entrada, de cualquier estado, lo tiene; entonces no se elimina, se pausa.
  const [uses, referenced, tickets] = await Promise.all([
    Promise.all(ids.map((id) => db.rpc('access_code_uses', { p_code_id: id }))),
    Promise.all(
      ids.map((id) => db.from('tickets').select('id', { count: 'exact', head: true }).eq('access_code_id', id)),
    ),
    ids.length > 0
      ? fetchAll((from, to) =>
          db
            .from('tickets')
            .select('id, access_code_id, buyer_name, buyer_document, status')
            .in('access_code_id', ids)
            .or(`status.neq.pending,reserved_until.gt."${now}"`)
            .order('created_at')
            .order('id')
            .range(from, to),
        )
      : Promise.resolve([]),
  ]);

  const eventTitle = event?.title ?? 'House Mates';
  const list = codes.map((row, i) => {
    const c = { ...row, kind: parseAccessKind(row.kind) };
    const used = (uses[i].data as number | null) ?? 0;
    const expired = !!c.valid_until && new Date(c.valid_until).getTime() < Date.now();
    const exhausted = c.max_uses !== null && used >= c.max_uses;
    const status = !c.active ? 'Pausado' : expired ? 'Vencido' : exhausted ? 'Agotado' : 'Activo';
    return {
      ...c,
      used,
      everUsed: !!referenced[i].count,
      expired,
      status,
      formatted: formatAccessCode(c.code),
      link: accessLink(c.code),
      whatsapp: whatsappHref(c, eventTitle),
      tickets: tickets.filter((t) => t.access_code_id === c.id),
    };
  });
  const created = searchParams.creado
    ? list.find((c) => c.code === normalizeAccessCode(searchParams.creado ?? ''))
    : undefined;
  const pageHref = `/admin/events/${params.id}/accesos`;

  return (
    <div className="max-w-4xl space-y-8">
      {created && (
        <section
          role="status"
          aria-label="Código creado"
          className="space-y-4 rounded-card border border-bone/25 bg-bone/[0.04] p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm text-bone/65">
              Código {created.kind === 'public' ? 'público' : 'personal'} para{' '}
              <span className="font-medium text-bone">{created.label}</span>
            </p>
            <Link href={pageHref} aria-label="Cerrar aviso" className="shrink-0 text-bone/50 hover:text-bone">
              ✕
            </Link>
          </div>
          <p className="select-all text-4xl font-bold tracking-[0.08em] tabular-nums sm:text-5xl">{created.formatted}</p>
          <p className="text-sm text-bone/60">
            {describeCode(created)}
            {created.valid_until && ` · vale hasta el ${formatLocal(created.valid_until, "d/MM 'a las' HH:mm")}`}. Con el
            link entra directo a comprar; con el código, lo escribe en la web.
          </p>
          <ShareButtons code={created.formatted} link={created.link} whatsapp={created.whatsapp} />
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Nuevo código</h2>
          <p className="mt-1 text-sm text-bone/55">
            Personal, para quien te escribe por Instagram: un código para sus entradas (las de ella y
            sus amigas). Público, para una historia: cada compra lleva una sola entrada, con tope o sin
            tope. Cada entrada que se compra con el código gasta una y queda marcada con él. Si se
            anula, se libera.
          </p>
        </div>
        <NewAccessForm eventId={params.id} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Códigos ({list.length})</h2>
        {list.length === 0 ? (
          <EmptyState title="Todavía no hay códigos">Creá el primero arriba.</EmptyState>
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {list.map((c) => {
              const toggle = toggleAccessCodeAction.bind(null, params.id, c.id, !c.active);
              return (
                <ContextMenu
                  key={c.id}
                  as="li"
                  label={`Acciones del código ${c.formatted}`}
                  items={[
                    { label: 'Copiar código', copy: c.formatted, done: `${c.formatted} copiado` },
                    { label: 'Copiar link', copy: c.link, done: 'Link copiado' },
                    {
                      label: c.active ? 'Pausar' : 'Activar',
                      hint: c.everUsed ? `Ya se usó: ${c.active ? 'se puede pausar' : 'no se puede eliminar'}` : undefined,
                      action: toggle,
                    },
                    ...(c.everUsed
                      ? []
                      : [
                          {
                            label: 'Eliminar',
                            danger: true,
                            action: deleteAccessCodeAction.bind(null, params.id, c.id),
                            confirm: {
                              title: `¿Eliminar el código ${c.formatted} (para ${c.label})?`,
                              body: 'Deja de servir para comprar. No se puede deshacer.',
                              label: 'Sí, eliminar',
                            },
                          },
                        ]),
                  ]}
                  className="space-y-3 px-4 py-4 sm:px-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold tracking-wide tabular-nums">{c.formatted}</p>
                        <Badge tone={c.status === 'Activo' ? 'club' : 'neutral'}>{c.status}</Badge>
                        <Badge tone={c.kind === 'public' ? 'casa' : 'neutral'}>{ACCESS_KIND_LABELS[c.kind]}</Badge>
                      </div>
                      <p className="mt-1 break-words text-sm text-bone/80">Para {c.label}</p>
                      <p className="mt-0.5 text-xs text-bone/55">
                        {c.max_uses === null
                          ? `${c.used} ${c.used === 1 ? 'usada' : 'usadas'} · sin tope`
                          : `${c.used} de ${c.max_uses} ${c.max_uses === 1 ? 'usada' : 'usadas'}`}
                        {c.kind === 'public' && ' · 1 por compra'}
                        {' · '}
                        {c.valid_until
                          ? `${c.expired ? 'venció' : 'vence'} ${formatLocal(c.valid_until, "d/MM 'a las' HH:mm")}`
                          : 'sin vencimiento'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={toggle}>
                        <SubmitButton variant="outline" size="sm">
                          {c.active ? 'Pausar' : 'Activar'}
                        </SubmitButton>
                      </form>
                      <ContextMenuButton />
                    </div>
                  </div>

                  <ShareButtons code={c.formatted} link={c.link} whatsapp={c.whatsapp} compact />

                  {c.tickets.length > 0 && (
                    <details className="group rounded-control border border-bone/10">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm text-bone/75 hover:text-bone [&::-webkit-details-marker]:hidden">
                        {c.tickets.length === 1 ? 'Ver la entrada comprada' : `Ver las ${c.tickets.length} entradas compradas`}
                        <ChevronDown size={15} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="divide-y divide-bone/10 border-t border-bone/10">
                        {c.tickets.map((t) => (
                          <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5">
                            <p className="min-w-0 break-words text-sm">
                              {t.buyer_name}
                              <span className="text-xs text-bone/55"> · CI {formatDocument(t.buyer_document)}</span>
                            </p>
                            <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </ContextMenu>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
