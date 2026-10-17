'use client';

import { useRef, useState, useTransition } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea, inputClass } from '@/components/ui/input';
import { formatUYU } from '@/lib/events';
import { createManualTicketAction, type ManualTicketResult } from './actions';

type TierOption = { id: string; name: string; price: number; available: number };

// Alta de una entrada vendida por transferencia o de una invitación.
// Al crearla muestra el link de la entrada para mandarlo por WhatsApp.
export function NewTicketForm({ eventId, tiers }: { eventId: string; tiers: TierOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ManualTicketResult | null>(null);
  const [tier, setTier] = useState(tiers[0]?.id ?? 'invitation');
  const [amount, setAmount] = useState(String(tiers[0]?.price ?? 0));
  const [copied, setCopied] = useState(false);

  const error = result && 'error' in result ? result : null;
  const fieldError = (name: string) => (error?.field === name ? error.error : null);

  function onTierChange(value: string) {
    setTier(value);
    const t = tiers.find((x) => x.id === value);
    setAmount(String(t?.price ?? 0));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createManualTicketAction(eventId, data);
      setResult(r);
      setCopied(false);
      if ('ok' in r) formRef.current?.reset();
    });
  }

  if (result && 'ok' in result) {
    const text = `Hola ${result.name.split(' ')[0]}, esta es tu entrada para House Mates: ${result.url}\nEs personal: en puerta te pedimos la cédula.`;
    const phone = result.phone?.replace(/\D/g, '');
    const waUrl = `https://wa.me/${phone ? (phone.startsWith('598') ? phone : `598${phone.replace(/^0/, '')}`) : ''}?text=${encodeURIComponent(text)}`;
    return (
      <Card className="space-y-4">
        <p className="text-sm font-medium">Entrada creada para {result.name}</p>
        <p className="break-all rounded-control bg-bone/5 px-3 py-2 text-sm text-bone/75">{result.url}</p>
        <div className="flex flex-wrap gap-2">
          <a href={waUrl} target="_blank" rel="noreferrer" className={buttonVariants({ size: 'sm' })}>
            Mandar por WhatsApp
          </a>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(result.url);
              setCopied(true);
            }}
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            {copied ? 'Copiado' : 'Copiar link'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
            Cargar otra
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre y apellido" error={fieldError('name')}>
          <Input name="name" required autoComplete="off" />
        </Field>
        <Field label="Cédula" hint="Con o sin puntos y guion" error={fieldError('document')}>
          <Input name="document" required inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Email" error={fieldError('email')}>
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Instagram" hint="Sin @" error={fieldError('instagram')}>
          <Input name="instagram" required autoComplete="off" />
        </Field>
        <Field label="Celular (opcional)" hint="Para mandarle la entrada por WhatsApp">
          <Input name="phone" type="tel" autoComplete="off" />
        </Field>
        <Field label="Tipo" error={fieldError('tier')}>
          <select name="tier" className={inputClass} value={tier} onChange={(e) => onTierChange(e.target.value)}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id} disabled={t.available <= 0}>
                {t.name} · {formatUYU(t.price)} {t.available <= 0 ? '· agotada' : `· quedan ${t.available}`}
              </option>
            ))}
            <option value="invitation">Invitación (gratis, sin tanda)</option>
          </select>
        </Field>
        {tier !== 'invitation' && (
          <Field label="Monto cobrado (UYU)" hint="Lo que pagó por transferencia">
            <Input
              name="amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        )}
      </div>
      <Field label="Notas (opcional)">
        <Textarea name="notes" rows={2} />
      </Field>
      {error && !error.field && (
        <p role="alert" className="text-sm text-alert">
          {error.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creando...' : tier === 'invitation' ? 'Crear invitación' : 'Crear entrada'}
      </Button>
    </form>
  );
}
