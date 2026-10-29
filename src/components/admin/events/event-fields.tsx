'use client';

import { Field } from '@/components/ui/field';
import { Input, Textarea, inputClass } from '@/components/ui/input';
import type { EventInput } from '@/lib/validation/schemas';

// canArchive: archivar y desarchivar es de los owners (el servidor también lo controla).
export function EventFields({
  event,
  onChange,
  canArchive = true,
}: {
  event: EventInput;
  onChange: (field: keyof EventInput, value: string | number) => void;
  canArchive?: boolean;
}) {
  const archiveLocked = !canArchive && event.status === 'archived';
  return (
    <div className="space-y-5">
      <Field label="Título">
        <Input
          value={event.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="HOUSE MATES Vol. 3"
        />
      </Field>

      <Field label="Dirección (slug)" hint="Se genera desde el título. Podés editarlo.">
        <Input
          value={event.slug}
          onChange={(e) => onChange('slug', e.target.value)}
          placeholder="house-mates-vol-3"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Inicio">
          <Input
            type="datetime-local"
            value={event.date_start}
            onChange={(e) => onChange('date_start', e.target.value)}
          />
        </Field>
        <Field label="Fin">
          <Input
            type="datetime-local"
            value={event.date_end}
            onChange={(e) => onChange('date_end', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Lugar">
        <Input
          value={event.location_name}
          onChange={(e) => onChange('location_name', e.target.value)}
          placeholder="Nombre del venue"
        />
      </Field>

      <Field label="URL del lugar (opcional)">
        <Input
          type="url"
          value={event.location_url ?? ''}
          onChange={(e) => onChange('location_url', e.target.value)}
          placeholder="https://maps.google.com/..."
        />
      </Field>

      <Field label="Formato" hint="Va al lado de la fecha en la landing, en /entradas y en la entrada. Ej: Open air, Indoor.">
        <Input
          value={event.format}
          maxLength={30}
          onChange={(e) => onChange('format', e.target.value)}
          placeholder="Open air"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Capacidad">
          <Input
            type="number"
            min={1}
            value={event.capacity}
            onChange={(e) => onChange('capacity', e.target.value)}
          />
        </Field>
        <Field
          label="Estado"
          hint={
            canArchive
              ? undefined
              : archiveLocked
                ? 'Solo un owner puede desarchivarlo.'
                : 'Solo los owners pueden archivar.'
          }
        >
          <select
            className={inputClass}
            value={event.status}
            disabled={archiveLocked}
            onChange={(e) => onChange('status', e.target.value)}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived" disabled={!canArchive}>
              Archivado
            </option>
          </select>
        </Field>
      </div>

      <Field
        label="Descripción (opcional)"
        hint="Se muestra en la landing, debajo de la próxima fecha, tal cual la escribís (con los saltos de línea)."
      >
        <Textarea
          rows={4}
          maxLength={1000}
          value={event.description_md ?? ''}
          onChange={(e) => onChange('description_md', e.target.value)}
        />
      </Field>
    </div>
  );
}

// Aviso cuando las tandas activas suman más lugares que la capacidad: create_ticket corta la
// venta al llegar a la capacidad del evento (invitaciones incluidas), aunque quede cupo en
// alguna tanda.
export function TierCapacityNotice({ capacity, tierTotal }: { capacity: number; tierTotal: number }) {
  if (!capacity || tierTotal <= capacity) return null;
  return (
    <p role="status" className="rounded-control border border-alert/30 bg-alert/[0.06] px-4 py-3 text-sm text-bone/80">
      Las tandas activas suman {tierTotal} lugares y la capacidad del evento es {capacity}: se vende hasta la
      capacidad ({capacity}). Las invitaciones también ocupan lugar.
    </p>
  );
}
