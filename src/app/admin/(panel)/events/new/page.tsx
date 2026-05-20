'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEventAction } from './actions'
import type { EventInput, TierInput } from '@/lib/validation/schemas'
import { Plus, Trash2 } from 'lucide-react'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

const emptyTier = (): TierInput => ({ name: '', price_uyu: 0, quantity_total: 0, description: '' })

export default function NewEventPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

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
  })

  const [tiers, setTiers] = useState<TierInput[]>([emptyTier()])

  function handleEventChange(field: keyof EventInput, value: string | number) {
    setEvent((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'title') next.slug = slugify(String(value))
      return next
    })
  }

  function handleTierChange(i: number, field: keyof TierInput, value: string | number) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
  }

  function addTier() {
    setTiers((prev) => [...prev, emptyTier()])
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      const result = await createEventAction(event, tiers)
      if (!result || 'error' in result) {
        setError(result?.error ?? 'Error inesperado. Intentá de nuevo.')
        return
      }
      window.location.href = `/admin/events/${result.id}`
    })
  }

  const inputClass =
    'w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-bone placeholder-bone/20 outline-none transition focus:border-bone/30'
  const labelClass = 'mb-1.5 block text-xs tracking-widest text-bone/50 uppercase'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-light text-bone">Nuevo evento</h1>
        <div className="mt-3 flex gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-0.5 w-16 transition-colors ${step >= s ? 'bg-bone' : 'bg-white/10'}`}
            />
          ))}
          <p className="ml-2 text-xs text-bone/40">Paso {step} de 2</p>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Título</label>
            <input
              className={inputClass}
              value={event.title}
              onChange={(e) => handleEventChange('title', e.target.value)}
              placeholder="HOUSE MATES Vol. 3"
            />
          </div>

          <div>
            <label className={labelClass}>Slug</label>
            <input
              className={inputClass}
              value={event.slug}
              onChange={(e) => handleEventChange('slug', e.target.value)}
              placeholder="house-mates-vol-3"
            />
            <p className="mt-1 text-xs text-bone/25">Auto-generado desde el título, editable.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Inicio</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={event.date_start}
                onChange={(e) => handleEventChange('date_start', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Fin</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={event.date_end}
                onChange={(e) => handleEventChange('date_end', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Lugar</label>
            <input
              className={inputClass}
              value={event.location_name}
              onChange={(e) => handleEventChange('location_name', e.target.value)}
              placeholder="Nombre del venue"
            />
          </div>

          <div>
            <label className={labelClass}>URL del lugar (opcional)</label>
            <input
              type="url"
              className={inputClass}
              value={event.location_url}
              onChange={(e) => handleEventChange('location_url', e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Capacidad</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={event.capacity}
                onChange={(e) => handleEventChange('capacity', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select
                className={inputClass}
                value={event.status}
                onChange={(e) => handleEventChange('status', e.target.value)}
              >
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <textarea
              rows={3}
              className={inputClass}
              value={event.description_md}
              onChange={(e) => handleEventChange('description_md', e.target.value)}
              placeholder="Texto libre, soporta Markdown."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="border border-white/10 px-5 py-2.5 text-xs tracking-widest text-bone/40 uppercase hover:text-bone/70 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!event.title || !event.slug || !event.date_start || !event.date_end || !event.location_name) {
                  setError('Completá todos los campos obligatorios.')
                  return
                }
                setError('')
                setStep(2)
              }}
              className="border border-bone/20 px-5 py-2.5 text-xs tracking-widest text-bone uppercase hover:border-bone/50 hover:bg-white/5 transition-colors"
            >
              Siguiente →
            </button>
          </div>
          {error && <p className="text-xs text-ember">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-bone/50">
            Agregá los tiers de tickets. Podés agregar más después desde la edición del evento.
          </p>

          {tiers.map((tier, i) => (
            <div key={i} className="border border-white/8 bg-white/3 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest text-bone/40 uppercase">Tier {i + 1}</p>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="text-bone/30 hover:text-ember transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input
                    className={inputClass}
                    value={tier.name}
                    onChange={(e) => handleTierChange(i, 'name', e.target.value)}
                    placeholder="General"
                  />
                </div>
                <div>
                  <label className={labelClass}>Precio (UYU)</label>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={tier.price_uyu || ''}
                    onChange={(e) => handleTierChange(i, 'price_uyu', e.target.value)}
                    placeholder="1200"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Cantidad</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={tier.quantity_total || ''}
                  onChange={(e) => handleTierChange(i, 'quantity_total', e.target.value)}
                  placeholder="200"
                />
              </div>

              <div>
                <label className={labelClass}>Descripción (opcional)</label>
                <input
                  className={inputClass}
                  value={tier.description}
                  onChange={(e) => handleTierChange(i, 'description', e.target.value)}
                  placeholder="Entrada general sin consumición"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addTier}
            className="flex items-center gap-2 text-xs text-bone/40 hover:text-bone/70 transition-colors"
          >
            <Plus size={14} />
            Agregar tier
          </button>

          {error && <p className="text-xs text-ember">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setError(''); setStep(1) }}
              className="border border-white/10 px-5 py-2.5 text-xs tracking-widest text-bone/40 uppercase hover:text-bone/70 transition-colors"
            >
              ← Volver
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="border border-bone/20 px-5 py-2.5 text-xs tracking-widest text-bone uppercase hover:border-bone/50 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? 'Creando...' : 'Crear evento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
