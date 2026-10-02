'use client';

import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { TierInput } from '@/lib/validation/schemas';

export function TierFields({
  title,
  tier,
  onChange,
  onRemove,
}: {
  title: string;
  tier: TierInput;
  onChange: (field: keyof TierInput, value: string | number) => void;
  onRemove?: () => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-bone/70">{title}</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${title}`}
            className="flex h-9 w-9 items-center justify-center rounded-control text-bone/50 hover:bg-bone/5 hover:text-bone"
          >
            <Trash2 size={15} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre">
          <Input value={tier.name} onChange={(e) => onChange('name', e.target.value)} placeholder="General" />
        </Field>
        <Field label="Precio (UYU)">
          <Input
            type="number"
            min={1}
            value={tier.price_uyu || ''}
            onChange={(e) => onChange('price_uyu', e.target.value)}
            placeholder="1200"
          />
        </Field>
        <Field label="Cantidad">
          <Input
            type="number"
            min={1}
            value={tier.quantity_total || ''}
            onChange={(e) => onChange('quantity_total', e.target.value)}
            placeholder="200"
          />
        </Field>
      </div>

      <Field label="Descripción (opcional)">
        <Input
          value={tier.description ?? ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Entrada general sin consumición"
        />
      </Field>
    </Card>
  );
}
