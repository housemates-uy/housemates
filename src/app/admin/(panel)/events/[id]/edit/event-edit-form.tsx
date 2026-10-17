'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { EventFields } from '@/components/admin/events/event-fields';
import { TierFields } from '@/components/admin/events/tier-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { emptyTier, formatUYU, slugify } from '@/lib/events';
import type { EventInput, TierInput, TierEditInput } from '@/lib/validation/schemas';
import type { TicketTier } from '@/types/database';
import { updateEventAction, updateTierAction } from '../actions';

function tierToInput(tier: TicketTier): TierEditInput {
  return {
    name: tier.name,
    price_uyu: tier.price_uyu,
    quantity_total: tier.quantity_total,
    description: tier.description ?? '',
    active: tier.active,
  };
}

function TierEditRow({ tier, eventId }: { tier: TicketTier; eventId: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [data, setData] = useState<TierEditInput>(tierToInput(tier));

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
    return (
      <li className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{tier.name}</p>
            {!tier.active && <Badge>Inactiva</Badge>}
          </div>
          <p className="mt-1 text-xs text-bone/55">
            {formatUYU(tier.price_uyu)} · {tier.quantity_sold}/{tier.quantity_total}
            {tier.description && ` · ${tier.description}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Editar tier ${tier.name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-bone/55 hover:bg-bone/5 hover:text-bone"
        >
          <Pencil size={15} strokeWidth={1.5} aria-hidden />
        </button>
      </li>
    );
  }

  return (
    <li className="space-y-4 bg-bone/[0.03] px-5 py-5">
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
          label="Cantidad total"
          hint={tier.quantity_sold > 0 ? `${tier.quantity_sold} ya vendidos: es el mínimo` : undefined}
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
}: {
  id: string;
  initial: EventInput;
  existingTiers: TicketTier[];
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

  return (
    <div className="space-y-8">
      {existingTiers.length > 0 && (
        <section className="rounded-card border border-bone/10">
          <h2 className="border-b border-bone/10 px-5 py-3 text-sm font-medium text-bone/70">Tiers</h2>
          <ul className="divide-y divide-bone/10">
            {existingTiers.map((tier) => (
              <TierEditRow key={tier.id} tier={tier} eventId={id} />
            ))}
          </ul>
        </section>
      )}

      <EventFields event={event} onChange={handleChange} />

      <section className="space-y-4 border-t border-bone/10 pt-6">
        <h2 className="text-sm font-medium text-bone/70">Tiers nuevos</h2>
        {newTiers.map((tier, i) => (
          <TierFields
            key={i}
            title={`Tier nuevo ${i + 1}`}
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
          Agregar tier
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
