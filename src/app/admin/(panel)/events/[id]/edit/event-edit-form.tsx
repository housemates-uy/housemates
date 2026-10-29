'use client';

import { useEffect, useState, useTransition } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ContextMenu, ContextMenuButton } from '@/components/admin/context-menu';
import { EventFields, TierCapacityNotice } from '@/components/admin/events/event-fields';
import { TierExtraFields, TierFields, TierTags } from '@/components/admin/events/tier-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { emptyTier, entryTime, formatUYU, slugify, toLocalInput } from '@/lib/events';
import type { EventInput, TierInput, TierEditInput } from '@/lib/validation/schemas';
import type { TicketTier } from '@/types/database';
import {
  deleteTierAction,
  toggleTierActiveAction,
  toggleTierSoldOutAction,
  updateEventAction,
  updateTierAction,
} from '../actions';

function tierToInput(tier: TicketTier): TierEditInput {
  return {
    name: tier.name,
    price_uyu: tier.price_uyu,
    quantity_total: tier.quantity_total,
    description: tier.description ?? '',
    active: tier.active,
    entry_until: entryTime(tier.entry_until) ?? '',
    sales_start: tier.sales_start ? toLocalInput(tier.sales_start) : '',
    presale_code: tier.presale_code ?? '',
  };
}

function TierEditRow({
  tier,
  eventId,
  hasTickets,
  archived,
}: {
  tier: TicketTier;
  eventId: string;
  hasTickets: boolean;
  archived: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [data, setData] = useState<TierEditInput>(tierToInput(tier));

  // "Editar" desde el menú de la tanda en el Resumen llega con #tanda-<id>: se abre esa.
  useEffect(() => {
    if (window.location.hash !== `#tanda-${tier.id}`) return;
    setEditing(true);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.setTimeout(() => document.getElementById(`tanda-${tier.id}`)?.scrollIntoView({ block: 'center' }), 0);
  }, [tier.id]);

  function handleSave() {
    setError('');
    startTransition(async () => {
      const result = await updateTierAction(tier.id, eventId, data);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setData(tierToInput(tier));
    setError('');
    setEditing(false);
  }

  if (!editing) {
    const isSoldOut = tier.sold_out_override || tier.quantity_sold >= tier.quantity_total;
    return (
      <ContextMenu
        as="li"
        label={`Acciones de la tanda ${tier.name}`}
        items={[
          { label: 'Editar', onSelect: () => setEditing(true) },
          ...(archived
            ? []
            : [
                {
                  label: tier.active ? 'Desactivar' : 'Activar',
                  hint: hasTickets
                    ? `Tiene entradas: ${tier.active ? 'se puede desactivar' : 'no se puede eliminar'}`
                    : undefined,
                  action: () => toggleTierActiveAction(tier.id, eventId, tier.active),
                },
                {
                  label: tier.sold_out_override ? 'Restaurar' : 'Agotar',
                  action: () => toggleTierSoldOutAction(tier.id, eventId, tier.sold_out_override),
                },
              ]),
          ...(hasTickets
            ? []
            : [
                {
                  label: 'Eliminar',
                  danger: true,
                  action: () => deleteTierAction(tier.id, eventId),
                  confirm: { title: `¿Eliminar la tanda ${tier.name}?`, body: 'No se puede deshacer.', label: 'Sí, eliminar' },
                },
              ]),
        ]}
        className="flex items-center justify-between gap-3 px-5 py-4"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{tier.name}</p>
            {!tier.active && <Badge>Inactiva</Badge>}
            {isSoldOut && <Badge tone="alert">Agotada</Badge>}
            <TierTags tier={tier} />
          </div>
          <p className="mt-1 text-xs text-bone/55">
            {formatUYU(tier.price_uyu)} · {tier.quantity_sold}/{tier.quantity_total}
            {tier.description && ` · ${tier.description}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Editar tanda ${tier.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-control text-bone/55 hover:bg-bone/5 hover:text-bone sm:h-10 sm:w-10"
          >
            <Pencil size={15} strokeWidth={1.5} aria-hidden />
          </button>
          <ContextMenuButton />
        </div>
      </ContextMenu>
    );
  }

  return (
    <li id={`tanda-${tier.id}`} className="space-y-4 bg-bone/[0.03] px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre">
          <Input value={data.name} onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Precio (UYU)">
          <Input
            type="number"
            min={1}
            value={data.price_uyu || ''}
            onChange={(e) => setData((p) => ({ ...p, price_uyu: Number(e.target.value) }))}
          />
        </Field>
        <Field
          label="Cupo"
          hint={tier.quantity_sold > 0 ? `${tier.quantity_sold} ya vendidas: es el mínimo` : undefined}
        >
          <Input
            type="number"
            min={tier.quantity_sold}
            value={data.quantity_total || ''}
            onChange={(e) => setData((p) => ({ ...p, quantity_total: Number(e.target.value) }))}
          />
        </Field>
      </div>
      <Field label="Descripción (opcional)">
        <Input
          value={data.description ?? ''}
          onChange={(e) => setData((p) => ({ ...p, description: e.target.value }))}
        />
      </Field>
      <TierExtraFields value={data} onChange={(field, value) => setData((p) => ({ ...p, [field]: value }))} />
      <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-bone/70">
        <input
          type="checkbox"
          checked={data.active}
          onChange={(e) => setData((p) => ({ ...p, active: e.target.checked }))}
          className="h-4 w-4 accent-bone"
        />
        Activa para compra
      </label>
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </li>
  );
}

export function EventEditForm({
  id,
  initial,
  existingTiers,
  tiersWithTickets,
  isOwner,
}: {
  id: string;
  initial: EventInput;
  existingTiers: TicketTier[];
  tiersWithTickets: string[];
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [event, setEvent] = useState<EventInput>(initial);
  const [newTiers, setNewTiers] = useState<TierInput[]>([]);

  function handleChange(field: keyof EventInput, value: string | number) {
    setEvent((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title') next.slug = slugify(String(value));
      return next;
    });
  }

  function handleTierChange(i: number, field: keyof TierInput, value: string | number) {
    setNewTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function handleSubmit() {
    setError('');
    startTransition(async () => {
      const result = await updateEventAction(id, event, newTiers);
      if (result?.error) setError(result.error);
    });
  }

  const tierTotal =
    existingTiers.filter((t) => t.active).reduce((sum, t) => sum + t.quantity_total, 0) +
    newTiers.reduce((sum, t) => sum + (Number(t.quantity_total) || 0), 0);

  return (
    <div className="space-y-8">
      {existingTiers.length > 0 && (
        <section className="rounded-card border border-bone/10">
          <h2 className="border-b border-bone/10 px-5 py-3 text-sm font-medium text-bone/70">Tandas</h2>
          <ul className="divide-y divide-bone/10">
            {existingTiers.map((tier) => (
              <TierEditRow
                key={tier.id}
                tier={tier}
                eventId={id}
                hasTickets={tiersWithTickets.includes(tier.id)}
                archived={initial.status === 'archived'}
              />
            ))}
          </ul>
        </section>
      )}

      <EventFields event={event} onChange={handleChange} canArchive={isOwner} />

      <TierCapacityNotice capacity={Number(event.capacity)} tierTotal={tierTotal} />

      <section className="space-y-4 border-t border-bone/10 pt-6">
        <h2 className="text-sm font-medium text-bone/70">Tandas nuevas</h2>
        {newTiers.map((tier, i) => (
          <TierFields
            key={i}
            title={`Tanda nueva ${i + 1}`}
            tier={tier}
            onChange={(field, value) => handleTierChange(i, field, value)}
            onRemove={() => setNewTiers((p) => p.filter((_, idx) => idx !== i))}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setNewTiers((p) => [...p, emptyTier()])}
        >
          <Plus size={15} strokeWidth={1.5} aria-hidden />
          Agregar tanda
        </Button>
      </section>

      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}

      <Button type="button" onClick={handleSubmit} disabled={pending}>
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </div>
  );
}
