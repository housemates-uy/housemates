'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { EventFields } from '@/components/admin/events/event-fields';
import { TierFields } from '@/components/admin/events/tier-fields';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { emptyTier, slugify } from '@/lib/events';
import type { EventInput, TierInput } from '@/lib/validation/schemas';
import { cn } from '@/lib/utils';
import { createEventAction } from './actions';

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [event, setEvent] = useState<EventInput>({
    title: '',
    slug: '',
    date_start: '',
    date_end: '',
    location_name: '',
    location_url: '',
    capacity: 200,
    status: 'draft',
    description_md: '',
  });

  const [tiers, setTiers] = useState<TierInput[]>([emptyTier()]);

  function handleEventChange(field: keyof EventInput, value: string | number) {
    setEvent((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title') next.slug = slugify(String(value));
      return next;
    });
  }

  function handleTierChange(i: number, field: keyof TierInput, value: string | number) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function goToTiers() {
    if (!event.title || !event.slug || !event.date_start || !event.date_end || !event.location_name) {
      setError('Completá todos los campos obligatorios.');
      return;
    }
    setError('');
    setStep(2);
  }

  function handleSubmit() {
    setError('');
    startTransition(async () => {
      const result = await createEventAction(event, tiers);
      if (!result || 'error' in result) {
        setError(result?.error ?? 'Error inesperado. Intentá de nuevo.');
        return;
      }
      window.location.href = `/admin/events/${result.id}`;
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <PageHeader title="Nuevo evento" />
        <div className="mt-4 flex items-center gap-2">
          {[1, 2].map((s) => (
            <span
              key={s}
              aria-hidden
              className={cn('h-0.5 w-16 transition-colors', step >= s ? 'bg-bone' : 'bg-bone/15')}
            />
          ))}
          <p className="ml-2 text-xs text-bone/55">Paso {step} de 2</p>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <EventFields event={event} onChange={handleEventChange} />
          {error && (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="button" onClick={goToTiers}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-bone/60">
            Agregá los tiers de tickets. Podés sumar más después desde la edición del evento.
          </p>

          {tiers.map((tier, i) => (
            <TierFields
              key={i}
              title={`Tier ${i + 1}`}
              tier={tier}
              onChange={(field, value) => handleTierChange(i, field, value)}
              onRemove={
                tiers.length > 1
                  ? () => setTiers((prev) => prev.filter((_, idx) => idx !== i))
                  : undefined
              }
            />
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTiers((prev) => [...prev, emptyTier()])}
          >
            <Plus size={15} strokeWidth={1.5} aria-hidden />
            Agregar tier
          </Button>

          {error && (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError('');
                setStep(1);
              }}
            >
              Volver
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={pending}>
              {pending ? 'Creando...' : 'Crear evento'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
