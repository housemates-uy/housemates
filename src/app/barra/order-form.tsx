'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassWater, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatUYU } from '@/lib/events';
import { cn } from '@/lib/utils';
import {
  simulateBarCheckoutAction,
  startBarCheckoutAction,
  type BarCheckoutInput,
  type BarCheckoutResult,
} from './actions';

type Product = { id: string; name: string; description: string | null; price: number; image: string | null };

const MAX_PER_PRODUCT = 20;

// Carta con la foto de cada trago y + / − debajo del nombre, email (nombre opcional) y el
// total fijo abajo con "Pagar". Si ningún trago tiene foto, la carta va sin fotos.
// El precio que se ve es el final: la barra no tiene cargo por servicio. El total que se
// cobra lo vuelve a calcular la base con los precios vigentes.
export function BarOrderForm({
  products,
  account,
  accountsEnabled,
  allowSimulate,
}: {
  products: Product[];
  account: { email: string; name: string | null } | null;
  accountsEnabled: boolean; // "Mi cuenta" prendida en /admin/config: se recomienda usarla
  allowSimulate: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [result, setResult] = useState<BarCheckoutResult | null>(null);
  const [intent, setIntent] = useState<'mp' | 'simulate'>('mp');
  const [pending, startTransition] = useTransition();

  const units = products.reduce((s, p) => s + (qty[p.id] ?? 0), 0);
  const total = products.reduce((s, p) => s + (qty[p.id] ?? 0) * p.price, 0);
  const error = result && 'error' in result ? result : null;
  const withPhotos = products.some((p) => p.image);

  function change(id: string, delta: number) {
    setResult(null);
    setQty((q) => ({ ...q, [id]: Math.min(MAX_PER_PRODUCT, Math.max(0, (q[id] ?? 0) + delta)) }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const chosen = submitter?.value === 'simulate' ? 'simulate' : 'mp';
    const data = new FormData(e.currentTarget);
    const input: BarCheckoutInput = {
      email: String(data.get('email') ?? ''),
      name: String(data.get('name') ?? ''),
      items: products.filter((p) => (qty[p.id] ?? 0) > 0).map((p) => ({ productId: p.id, quantity: qty[p.id] })),
    };
    setIntent(chosen);
    startTransition(async () => {
      const r = await (chosen === 'simulate' ? simulateBarCheckoutAction(input) : startBarCheckoutAction(input));
      setResult(r);
      if ('url' in r) {
        if (/^https?:\/\//.test(r.url)) window.location.assign(r.url);
        else router.push(r.url);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-10">
      <ul aria-label="Carta" className="divide-y divide-bone/10 border-y border-bone/10">
        {products.map((p) => {
          const n = qty[p.id] ?? 0;
          return (
            <li key={p.id} className="flex gap-4 py-5">
              {withPhotos && (
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-bone/10 bg-bone/[0.04] sm:h-28 sm:w-28">
                  {p.image ? (
                    <Image src={p.image} alt="" fill sizes="112px" className="object-cover" />
                  ) : (
                    <GlassWater size={28} strokeWidth={1.5} aria-hidden className="text-bone/25" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[1.375rem] font-bold leading-tight tracking-tight">
                  {p.name}
                  {n > 0 && (
                    <span aria-hidden className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-violet align-middle" />
                  )}
                </p>
                {p.description && <p className="mt-1 text-sm leading-snug text-bone/60">{p.description}</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-lg text-bone/85">{formatUYU(p.price)}</p>
                  <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Cantidad de ${p.name}`}>
                    <button
                      type="button"
                      onClick={() => change(p.id, -1)}
                      disabled={n === 0}
                      aria-label={`Sacar un ${p.name}`}
                      className="flex h-14 w-14 items-center justify-center rounded-full border border-bone/25 transition-colors active:bg-bone/10 disabled:opacity-30"
                    >
                      <Minus size={22} aria-hidden />
                    </button>
                    <output aria-live="polite" className="w-9 text-center text-2xl font-bold tabular-nums">
                      {n}
                    </output>
                    <button
                      type="button"
                      onClick={() => change(p.id, 1)}
                      disabled={n >= MAX_PER_PRODUCT}
                      aria-label={`Agregar un ${p.name}`}
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-full border transition-colors active:bg-bone/10 disabled:opacity-30',
                        n > 0 ? 'border-bone bg-bone text-ink active:bg-bone/80' : 'border-bone/25',
                      )}
                    >
                      <Plus size={22} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <fieldset className="mt-10 space-y-5">
        <legend className="mb-1 text-sm font-medium text-bone/70">Tus datos</legend>
        <Field
          label="Email"
          hint="Te mandamos los QRs acá"
          error={error?.field === 'email' ? error.error : null}
        >
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={account?.email ?? ''}
            className="h-14 text-base"
          />
        </Field>
        <Field label="Nombre (opcional)" error={error?.field === 'name' ? error.error : null}>
          <Input name="name" autoComplete="name" defaultValue={account?.name ?? ''} className="h-14 text-base" />
        </Field>
      </fieldset>

      {account ? (
        <p className="mt-6 text-sm text-bone/60">
          Comprás con tu cuenta <span className="text-bone">{account.email}</span>: el pedido queda guardado ahí.
        </p>
      ) : accountsEnabled ? (
        <div className="mt-6 rounded-card border border-bone/15 bg-ink/40 p-5">
          <p className="text-sm font-bold">Te recomendamos usar tu cuenta</p>
          <p className="mt-1.5 text-sm leading-relaxed text-bone/65">
            Así tus pedidos quedan guardados junto con tu entrada y no dependés del mail. La cuenta se
            crea cuando comprás tu entrada.
          </p>
          <Link
            href="/cuenta/ingresar?next=/barra"
            className="mt-3 inline-block text-sm font-medium underline decoration-bone/40 underline-offset-4 hover:decoration-bone"
          >
            Ingresar a mi cuenta
          </Link>
        </div>
      ) : null}

      {/* Total y pagar: fijo abajo mientras se arma el pedido */}
      <div className="sticky bottom-0 -mx-5 mt-10 border-t border-bone/10 bg-ink/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-bone/65">
            {units === 0 ? 'Elegí tus tragos' : `${units} ${units === 1 ? 'trago' : 'tragos'}`}
          </span>
          <span className="text-3xl font-bold tracking-tight">{formatUYU(total)}</span>
        </div>
        {error && error.field !== 'email' && error.field !== 'name' && (
          <p role="alert" className="mt-3 text-sm text-alert">
            {error.error}
          </p>
        )}
        <Button
          type="submit"
          value="mp"
          size="lg"
          disabled={pending || units === 0}
          className="mt-4 h-14 w-full text-base"
        >
          {pending && intent === 'mp'
            ? 'Te llevamos a Mercado Pago...'
            : units === 0
              ? 'Pagar con Mercado Pago'
              : `Pagar ${formatUYU(total)} con Mercado Pago`}
        </Button>
        {allowSimulate && (
          <Button
            type="submit"
            value="simulate"
            variant="outline"
            size="lg"
            disabled={pending || units === 0}
            className="mt-2 h-12 w-full border-dashed"
          >
            {pending && intent === 'simulate' ? 'Simulando...' : 'Simular pago (solo local)'}
          </Button>
        )}
      </div>
    </form>
  );
}
