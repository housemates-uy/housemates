'use client';

import { Field } from '@/components/ui/field';
import { Input, Textarea, inputClass } from '@/components/ui/input';
import type { EventInput } from '@/lib/validation/schemas';

export function EventFields({
  event,
  onChange,
}: {
  event: EventInput;
  onChange: (field: keyof EventInput, value: string | number) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Título">
        <Input
          value={event.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="HOUSE MATES Vol. 3"
        />
      </Field>

      <Field label="Slug" hint="Se genera desde el título. Podés editarlo.">
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Capacidad">
          <Input
            type="number"
            min={1}
            value={event.capacity}
            onChange={(e) => onChange('capacity', e.target.value)}
          />
        </Field>
        <Field label="Estado">
          <select
            className={inputClass}
            value={event.status}
            onChange={(e) => onChange('status', e.target.value)}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </Field>
      </div>

      <Field label="Descripción (opcional)" hint="Texto libre, soporta Markdown.">
        <Textarea
          rows={3}
          value={event.description_md ?? ''}
          onChange={(e) => onChange('description_md', e.target.value)}
        />
      </Field>
    </div>
  );
}
