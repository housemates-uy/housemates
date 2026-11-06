import { requireAdmin } from '@/lib/auth/admin';
import { ContextMenu, ContextMenuButton } from '@/components/admin/context-menu';
import { SubmitButton } from '@/components/admin/submit-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/card';
import { describeDiscount } from '@/lib/discounts';
import { formatLocal } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteDiscountCodeAction, toggleDiscountCodeAction } from './actions';
import { NewCodeForm } from './new-code-form';

export const metadata = { title: 'Descuentos' };

// Códigos de descuento del evento. La persona lo escribe al comprar y se le descuenta del
// precio de la entrada (con Mercado Pago y con transferencia).
export default async function DiscountCodesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { creado?: string };
}) {
  const admin = await requireAdmin();
  const isOwner = admin.role === 'owner';
  const db = createAdminClient();

  const { data: codes } = await db
    .from('discount_codes')
    .select('id, code, kind, value, max_uses, valid_until, active, created_at')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false });

  // `uses`: entradas válidas o en curso (lo que cuenta para el tope). `everUsed`: alguna entrada,
  // de cualquier estado, lo tiene; entonces no se elimina, se pausa.
  const withUses = await Promise.all(
    (codes ?? []).map(async (c) => {
      const [{ data }, { count }] = await Promise.all([
        db.rpc('discount_code_uses', { p_code_id: c.id }),
        db.from('tickets').select('id', { count: 'exact', head: true }).eq('discount_code_id', c.id),
      ]);
      return { ...c, uses: (data as number | null) ?? 0, everUsed: !!count };
    }),
  );
  const now = Date.now();

  return (
    <div className="max-w-4xl space-y-8">
      {isOwner ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Nuevo código</h2>
            <p className="mt-1 text-sm text-bone/55">
              Se aplica a cualquier tanda de este evento. Cada uso es una entrada: si se anula, el uso
              se libera.
            </p>
          </div>
          <NewCodeForm eventId={params.id} created={searchParams.creado} />
        </section>
      ) : (
        <p className="text-sm text-bone/55">Solo los owners pueden crear o pausar códigos.</p>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Códigos ({withUses.length})</h2>
        {withUses.length === 0 ? (
          <EmptyState title="Todavía no hay códigos">Creá el primero arriba.</EmptyState>
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {withUses.map((c) => {
              const expired = !!c.valid_until && new Date(c.valid_until).getTime() < now;
              const exhausted = c.max_uses !== null && c.uses >= c.max_uses;
              const status = !c.active ? 'Pausado' : expired ? 'Vencido' : exhausted ? 'Agotado' : 'Activo';
              const toggle = toggleDiscountCodeAction.bind(null, params.id, c.id, !c.active);
              return (
                <ContextMenu
                  key={c.id}
                  as="li"
                  label={`Acciones del código ${c.code}`}
                  items={[
                    { label: 'Copiar código', copy: c.code, done: `${c.code} copiado` },
                    ...(isOwner
                      ? [
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
                                  action: deleteDiscountCodeAction.bind(null, params.id, c.id),
                                  confirm: { title: `¿Eliminar el código ${c.code}?`, body: 'No se puede deshacer.', label: 'Sí, eliminar' },
                                },
                              ]),
                        ]
                      : []),
                  ]}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold tracking-wide">{c.code}</p>
                      <Badge tone={status === 'Activo' ? 'club' : 'neutral'}>{status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-bone/55">
                      {describeDiscount({ kind: c.kind, value: Number(c.value) })}
                      {' · '}
                      {c.max_uses !== null ? `${c.uses} de ${c.max_uses} usos` : `${c.uses} usos`}
                      {c.valid_until && ` · vence ${formatLocal(c.valid_until, "d/MM 'a las' HH:mm")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isOwner && (
                      <form action={toggle}>
                        <SubmitButton variant="ghost" size="sm">
                          {c.active ? 'Pausar' : 'Activar'}
                        </SubmitButton>
                      </form>
                    )}
                    <ContextMenuButton />
                  </div>
                </ContextMenu>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
