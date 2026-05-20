'use client'

import { useState, useTransition } from 'react'
import { updateEventAction, updateTierAction } from '../actions'
import type { EventInput, TierInput, TierEditInput } from '@/lib/validation/schemas'
import type { TicketTier } from '@/types/database'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

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

const inputClass =
  'w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-bone placeholder-bone/20 outline-none transition focus:border-bone/30'
const labelClass = 'mb-1.5 block text-xs tracking-widest text-bone/50 uppercase'

function TierEditRow({ tier, eventId }: { tier: TicketTier; eventId: string }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [data, setData] = useState<TierEditInput>({
    name: tier.name,
    price_uyu: tier.price_uyu,
    quantity_total: tier.quantity_total,
    description: tier.description ?? '',
    active: tier.active,
  })

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result = await updateTierAction(tier.id, eventId, data)
      if (result?.error) {
        setError(result.error)
      } else {
        setEditing(false)
      }
    })
  }

  function handleCancel() {
    setData({
      name: tier.name,
      price_uyu: tier.price_uyu,
      quantity_total: tier.quantity_total,
      description: tier.description ?? '',
      active: tier.active,
    })
    setError('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between px-4 py-3 group">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-bone">{tier.name}</p>
            {!tier.active && (
              <span className="text-xs text-bone/30 border border-white/10 px-1.5 py-0.5 leading-none">inactiva</span>
            )}
          </div>
          {tier.description && <p className="text-xs text-bone/35 mt-0.5">{tier.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-bone/40 tabular-nums">
            ${tier.price_uyu.toLocaleString('es-UY')} · {tier.quantity_sold}/{tier.quantity_total}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-bone/25 hover:text-bone/70 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-3 bg-white/3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            className={inputClass}
            value={data.name}
            onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelClass}>Precio (UYU)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={data.price_uyu || ''}
            onChange={(e) => setData((p) => ({ ...p, price_uyu: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Cantidad total</label>
          <input
            type="number"
            min={tier.quantity_sold}
            className={inputClass}
            value={data.quantity_total || ''}
            onChange={(e) => setData((p) => ({ ...p, quantity_total: Number(e.target.value) }))}
          />
          {tier.quantity_sold > 0 && (
            <p className="mt-1 text-xs text-bone/25">{tier.quantity_sold} ya vendidos — mínimo {tier.quantity_sold}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Descripción (opcional)</label>
          <input
            className={inputClass}
            value={data.description}
            onChange={(e) => setData((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={data.active}
          onChange={(e) => setData((p) => ({ ...p, active: e.target.checked }))}
          className="accent-bone"
        />
        <span className="text-xs text-bone/50">Activa para compra</span>
      </label>
      {error && <p className="text-xs text-ember">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="flex items-center gap-1.5 border border-bone/20 px-4 py-2 text-xs tracking-widest text-bone uppercase hover:border-bone/40 disabled:opacity-40 transition-colors"
        >
          <Check size={12} />
          {pending ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="flex items-center gap-1.5 border border-white/10 px-4 py-2 text-xs tracking-widest text-bone/40 uppercase hover:text-bone/70 transition-colors"
        >
          <X size={12} />
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function EventEditForm({
  id,
  initial,
  existingTiers,
}: {
  id: string
  initial: EventInput
  existingTiers: TicketTier[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [event, setEvent] = useState<EventInput>(initial)
  const [newTiers, setNewTiers] = useState<TierInput[]>([])
  const [showAddTier, setShowAddTier] = useState(false)

  function handleChange(field: keyof EventInput, value: string | number) {
    setEvent((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'title') next.slug = slugify(String(value))
      return next
    })
  }

  function handleTierChange(i: number, field: keyof TierInput, value: string | number) {
    setNewTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
  }

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      const result = await updateEventAction(id, event, newTiers)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-6">
      {/* Tiers existentes */}
      {existingTiers.length > 0 && (
        <div className="border border-white/8 divide-y divide-white/8">
          <p className="px-4 py-3 text-xs tracking-widest text-bone/40 uppercase">Tiers</p>
          {existingTiers.map((tier) => (
            <TierEditRow key={tier.id} tier={tier} eventId={id} />
          ))}
        </div>
      )}

      {/* Campos del evento */}
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Título</label>
          <input className={inputClass} value={event.title} onChange={(e) => handleChange('title', e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Slug</label>
          <input className={inputClass} value={event.slug} onChange={(e) => handleChange('slug', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Inicio</label>
            <input type="datetime-local" className={inputClass} value={event.date_start} onChange={(e) => handleChange('date_start', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Fin</label>
            <input type="datetime-local" className={inputClass} value={event.date_end} onChange={(e) => handleChange('date_end', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Lugar</label>
          <input className={inputClass} value={event.location_name} onChange={(e) => handleChange('location_name', e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>URL del lugar (opcional)</label>
          <input type="url" className={inputClass} value={event.location_url ?? ''} onChange={(e) => handleChange('location_url', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Capacidad</label>
            <input type="number" min={1} className={inputClass} value={event.capacity} onChange={(e) => handleChange('capacity', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select className={inputClass} value={event.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Descripción (opcional)</label>
          <textarea rows={3} className={inputClass} value={event.description_md ?? ''} onChange={(e) => handleChange('description_md', e.target.value)} />
        </div>
      </div>

      {/* Agregar tiers nuevos */}
      <div className="border-t border-white/8 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-widest text-bone/40 uppercase">Nuevo tier</p>
          {!showAddTier && (
            <button
              type="button"
              onClick={() => { setShowAddTier(true); setNewTiers([emptyTier()]) }}
              className="flex items-center gap-1.5 text-xs text-bone/40 hover:text-bone/70 transition-colors"
            >
              <Plus size={13} /> Agregar
            </button>
          )}
        </div>

        {showAddTier && newTiers.map((tier, i) => (
          <div key={i} className="border border-white/8 bg-white/3 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-bone/30">Tier nuevo {i + 1}</p>
              <button type="button" onClick={() => setNewTiers((p) => p.filter((_, idx) => idx !== i))} className="text-bone/25 hover:text-ember">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nombre</label>
                <input className={inputClass} value={tier.name} onChange={(e) => handleTierChange(i, 'name', e.target.value)} placeholder="General" />
              </div>
              <div>
                <label className={labelClass}>Precio (UYU)</label>
                <input type="number" min={1} className={inputClass} value={tier.price_uyu || ''} onChange={(e) => handleTierChange(i, 'price_uyu', e.target.value)} placeholder="1200" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Cantidad</label>
              <input type="number" min={1} className={inputClass} value={tier.quantity_total || ''} onChange={(e) => handleTierChange(i, 'quantity_total', e.target.value)} placeholder="200" />
            </div>
          </div>
        ))}

        {showAddTier && (
          <button type="button" onClick={() => setNewTiers((p) => [...p, emptyTier()])} className="flex items-center gap-1.5 text-xs text-bone/30 hover:text-bone/60 transition-colors">
            <Plus size={12} /> Otro tier
          </button>
        )}
      </div>

      {error && <p className="text-xs text-ember">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="border border-bone/20 px-5 py-2.5 text-xs tracking-widest text-bone uppercase hover:border-bone/50 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}
