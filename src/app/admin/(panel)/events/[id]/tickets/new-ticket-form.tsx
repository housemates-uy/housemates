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
  // Arranca en la primera tanda con lugar (una agotada se puede elegir igual, como excepción).
  const firstOpen = tiers.find((t) => t.available > 0);
  const [tier, setTier] = useState(firstOpen?.id ?? 'invitation');
  const [amount, setAmount] = useState(String(firstOpen?.price ?? 0));
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
        <p className="text-sm text-bone/60">
          {result.mailed ? 'Le mandamos la entrada por mail.' : 'No se mandó mail.'}
        </p>
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
        <Field label="Instagram (opcional)" hint="Sin @" error={fieldError('instagram')}>
          <Input name="instagram" autoComplete="off" />
        </Field>
        <Field label="Celular (opcional)" hint="Para mandarle la entrada por WhatsApp" error={fieldError('phone')}>
          <Input name="phone" type="tel" autoComplete="off" maxLength={30} />
        </Field>
        <Field
          label="Tipo"
          hint={
            tiers.find((t) => t.id === tier && t.available <= 0)
              ? 'Tanda agotada: se carga igual, como excepción.'
              : undefined
          }
          error={fieldError('tier')}
        >
          <select name="tier" className={inputClass} value={tier} onChange={(e) => onTierChange(e.target.value)}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {formatUYU(t.price)} {t.available <= 0 ? '· agotada' : `· quedan ${t.available}`}
              </option>
            ))}
            <option value="invitation">Cortesía (gratis)</option>
          </select>
        </Field>
        {tier === 'invitation' ? (
          <Field label="Monto cobrado (UYU)" hint="Cortesía: entrada gratis, no ocupa lugar de ninguna tanda">
            <Input type="number" value={0} disabled readOnly />
          </Field>
        ) : (
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
      <Field label="Notas (opcional)" hint="Se ven en la lista de entradas, solo en el admin" error={fieldError('notes')}>
        <Textarea name="notes" rows={2} maxLength={500} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-bone/75">
        <input type="checkbox" name="send_mail" defaultChecked className="h-4 w-4 accent-bone" />
        Mandarle la entrada por mail
      </label>
      {error && !error.field && (
        <p role="alert" className="text-sm text-alert">
          {error.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creando...' : tier === 'invitation' ? 'Crear cortesía' : 'Crear entrada'}
      </Button>
    </form>
  );
}
