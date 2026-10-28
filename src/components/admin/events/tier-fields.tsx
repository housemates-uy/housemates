'use client';

import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { entryTime, formatLocal } from '@/lib/events';
import type { TierInput } from '@/lib/validation/schemas';
import type { TicketTier } from '@/types/database';

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

      <TierExtraFields value={tier} onChange={onChange} />
    </Card>
  );
}

// Etiquetas de la lista de tiers: preventa, ingreso temprano y si todavía no salió a la venta.
export function TierTags({ tier }: { tier: Pick<TicketTier, 'presale_code' | 'entry_until' | 'sales_start'> }) {
  const until = entryTime(tier.entry_until);
  const upcoming = tier.sales_start && new Date(tier.sales_start) > new Date();
  return (
    <>
      {tier.presale_code && <Badge tone="club">Preventa · {tier.presale_code}</Badge>}
      {until && <Badge>Ingreso hasta {until}</Badge>}
      {upcoming && <Badge>Sale el {formatLocal(tier.sales_start!, "d/MM 'a las' HH:mm")}</Badge>}
    </>
  );
}

type TierExtras = Pick<TierInput, 'entry_until' | 'sales_start' | 'presale_code'>;

// Ingreso temprano, salida a la venta y preventa. Se usa en el alta y en la edición de tiers.
// Ver docs/LOGICA_DE_NEGOCIO.md → "Tandas".
export function TierExtraFields({
  value,
  onChange,
}: {
  value: TierExtras;
  onChange: (field: keyof TierExtras, value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Ingreso hasta (opcional)" hint="Tanda temprana. Hora de Montevideo, ej. 00:30">
        <Input type="time" value={value.entry_until} onChange={(e) => onChange('entry_until', e.target.value)} />
      </Field>
      <Field label="Sale a la venta (opcional)" hint="Hasta entonces se ve como Próximamente">
        <Input
          type="datetime-local"
          value={value.sales_start}
          onChange={(e) => onChange('sales_start', e.target.value)}
        />
      </Field>
      <Field label="Código de preventa (opcional)" hint="Oculta al público: se compra solo con el link">
        <Input
          value={value.presale_code}
          onChange={(e) => onChange('presale_code', e.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="Ej: COMUNIDAD"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={30}
          className="uppercase tracking-wide"
        />
      </Field>
    </div>
  );
}
