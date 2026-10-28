'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Check, Copy, FileUp, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { tandaStateLabel, type TandaState } from '@/components/ui/tanda-status';
import { formatUYU } from '@/lib/events';
import { discountAmount, quote, type PayMethod } from '@/lib/pricing';
import { validateCI } from '@/lib/validation/document';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/app/cuenta/actions';
import { checkDiscountAction, startCheckoutAction, type CheckoutState } from './actions';

// state: Disponible / Sold out / Próximamente (src/lib/next-event.ts). entryUntil: ingreso
// temprano ("00:30"). presale: tanda de preventa (llegó con el link).
type Tanda = {
  id: string;
  name: string;
  price: number;
  purchasable: boolean;
  state: TandaState;
  entryUntil: string | null;
  presale: boolean;
};
type Applied = { code: string; kind: 'percent' | 'fixed'; value: number; label: string };
// Sesión iniciada (src/lib/customers.ts): los datos vienen del perfil y el email es el de la cuenta.
type Account = { email: string; name: string; document: string; phone: string };
// Opción de bus activa del evento (src/lib/transport.ts). left: lugares que quedan, null = sin cupo.
type Bus = { id: string; name: string; departure: string; price: number; left: number | null };

const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const RECEIPT_MAX = 4 * 1024 * 1024;

function Submit({ method, total }: { method: PayMethod; total: number }) {
  const { pending } = useFormStatus();
  const label =
    method === 'transfer'
      ? pending
        ? 'Enviando comprobante...'
        : 'Enviar comprobante'
      : pending
        ? 'Te llevamos a Mercado Pago...'
        : `Pagar ${formatUYU(total)} con Mercado Pago`;
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {label}
    </Button>
  );
}

// Las fotos muy pesadas se achican en el celular antes de mandarlas (el límite es 4 MB).
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= RECEIPT_MAX * 0.9) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? 'Copiado' : 'Copiar datos'}
    </Button>
  );
}

// Compra: 1) tanda (puede venir elegida desde la landing), 2) datos de la persona (la
// entrada es nominativa) y, sin sesión, una contraseña opcional para crear la cuenta,
// 3) código de descuento opcional, 4) cómo paga: Mercado Pago (con cargo por servicio) o
// transferencia (sin cargo, con comprobante).
export function BuyForm({
  tandas,
  initialTanda,
  presaleCode,
  methods,
  transferDetails,
  transport = [],
  account,
}: {
  tandas: Tanda[];
  initialTanda?: string;
  presaleCode?: string;
  methods: { mercadopago: boolean; transfer: boolean };
  transferDetails: string;
  transport?: Bus[];
  account: Account | null;
}) {
  const [state, action] = useFormState<CheckoutState, FormData>(startCheckoutAction, null);
  const firstAvailable = tandas.find((t) => t.purchasable)?.id;
  const [selected, setSelected] = useState(
    tandas.find((t) => t.id === initialTanda && t.purchasable)?.id ?? firstAvailable,
  );
  const tanda = tandas.find((t) => t.id === selected);

  // Arranca en transferencia si está activa: Mercado Pago se conecta más adelante.
  const [method, setMethod] = useState<PayMethod>(methods.transfer ? 'transfer' : 'mercadopago');

  // Código de descuento: se valida en el servidor al tocar "Aplicar".
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [applied, setApplied] = useState<Applied | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  // Comprobante
  const fileRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<{ name: string; size: number } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  // El campo del comprobante se desmonta al cambiar a Mercado Pago: se olvida el archivo.
  useEffect(() => {
    if (method !== 'transfer') {
      setReceipt(null);
      setReceiptError(null);
    }
  }, [method]);

  // El error del servidor se oculta apenas la persona edita ese campo.
  const [editedField, setEditedField] = useState<string | null>(null);
  useEffect(() => setEditedField(null), [state]);
  // Si el servidor rechazó el código (p. ej. se agotó mientras completaba), se saca y se abre
  // la sección del código, que es donde se muestra el error.
  useEffect(() => {
    if (state?.field === 'code') {
      setApplied(null);
      setCodeOpen(true);
    }
  }, [state]);
  // La cédula se valida en el navegador al salir del campo (mismo dígito verificador que el servidor).
  const [ciError, setCiError] = useState<string | null>(null);
  const fieldError = (name: string) => (state?.field === name && editedField !== name ? state.error : null);
  // "Ya tenés cuenta" depende del email: se oculta también si lo corrige.
  const passwordError = editedField === 'email' ? null : fieldError('password');
  const [signingOut, startSigningOut] = useTransition();

  // Transporte: "No, gracias" por defecto (busId vacío).
  const busRef = useRef<HTMLFieldSetElement>(null);
  const [busId, setBusId] = useState('');
  const bus = transport.find((o) => o.id === busId);
  // Si el servidor dice que ese bus se llenó (o se desactivó) mientras completaba, se marca
  // sin lugares, se vuelve a "No, gracias" y se muestra el aviso. Sin router.refresh(): en
  // esta app vuelve a montar el formulario y se pierde lo que la persona completó.
  const submittedBus = useRef('');
  const [goneBus, setGoneBus] = useState<string[]>([]);
  useEffect(() => {
    if (state?.field !== 'transport') return;
    const gone = submittedBus.current;
    if (gone) setGoneBus((list) => (list.includes(gone) ? list : [...list, gone]));
    setBusId('');
    busRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state]);

  const discount = tanda ? discountAmount(tanda.price, applied) : 0;
  const price = tanda ? quote(tanda.price, discount, method, bus?.price ?? 0) : null;

  function applyCode() {
    if (!selected || !codeInput.trim()) return;
    setCodeError(null);
    startChecking(async () => {
      const res = await checkDiscountAction(selected, codeInput);
      if ('error' in res) {
        setApplied(null);
        setCodeError(res.error);
      } else {
        setApplied({ code: res.code, kind: res.kind, value: res.value, label: res.label });
        setCodeOpen(false);
      }
    });
  }

  async function onReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    setReceiptError(null);
    setEditedField('receipt');
    const input = e.target;
    const original = input.files?.[0];
    if (!original) return setReceipt(null);
    const file = await shrinkImage(original);
    if (file !== original) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
    if (file.size > RECEIPT_MAX) {
      setReceiptError('Pesa más de 4 MB. Mandá una captura de pantalla o un PDF más liviano.');
    }
    setReceipt({ name: file.name, size: file.size });
  }

  const bothMethods = methods.mercadopago && methods.transfer;

  return (
    <form action={action} onSubmit={() => (submittedBus.current = busId)} className="space-y-9">
      {/* 1 · Tanda */}
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-bone/70">Elegí tu tanda</legend>
        {/* Link de preventa: create_ticket vuelve a validar el código en el servidor. */}
        {presaleCode && <input type="hidden" name="presale" value={presaleCode} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {tandas.map((t) => (
            <label
              key={t.id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-card border p-5 transition-colors',
                t.state.kind === 'sold_out' && 'cursor-not-allowed opacity-60',
                // Próxima tanda: se ve el precio (sin tacharlo) pero todavía no se puede elegir.
                t.state.kind === 'upcoming' && 'cursor-not-allowed border-dashed',
                selected === t.id
                  ? t.presale
                    ? 'border-violet bg-violet/[0.08]'
                    : 'border-bone bg-bone/[0.06]'
                  : 'border-bone/15 hover:border-bone/40',
              )}
            >
              <input
                type="radio"
                name="tier"
                value={t.id}
                checked={selected === t.id}
                disabled={!t.purchasable}
                onChange={() => setSelected(t.id)}
                className="sr-only"
              />
              {t.presale && (
                <Badge tone="club" className="mb-3 w-fit">
                  Preventa
                </Badge>
              )}
              <span className="text-[11px] font-bold uppercase tracking-label text-bone/55">{t.name}</span>
              <span
                className={cn(
                  'mt-2 text-3xl font-bold tracking-tight',
                  t.state.kind === 'sold_out' && 'line-through decoration-2',
                  t.state.kind === 'upcoming' && 'text-bone/60',
                )}
              >
                {formatUYU(t.price)}
              </span>
              {t.entryUntil && <span className="mt-1.5 text-sm text-bone/80">Ingreso hasta {t.entryUntil}</span>}
              <span
                className={cn(
                  'mt-3 text-sm font-bold uppercase tracking-[0.12em]',
                  t.purchasable ? 'text-bone/70' : t.state.kind === 'upcoming' ? 'text-bone/55' : 'text-alert',
                )}
              >
                {tandaStateLabel(t.state)}
              </span>
              {t.state.kind === 'upcoming' && t.state.opens && (
                <span className="mt-1 text-xs text-bone/50">Sale el {t.state.opens}</span>
              )}
              {selected === t.id && <span aria-hidden className="absolute right-4 top-4 h-3 w-3 rounded-full bg-violet" />}
            </label>
          ))}
        </div>
        {fieldError('tier') && <p className="text-sm text-alert">{fieldError('tier')}</p>}
      </fieldset>

      {/* 2 · Datos */}
      <fieldset className="space-y-5">
        <legend className="mb-1 text-sm font-medium text-bone/70">Tus datos</legend>
        {account && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-bone/10 bg-bone/[0.03] px-4 py-3 text-sm">
            <input type="hidden" name="as_account" value="1" />
            <span className="text-bone/60">Comprando como</span>
            <span className="min-w-0 break-all font-medium">{account.email}</span>
            <span aria-hidden className="text-bone/30">·</span>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => startSigningOut(() => signOutAction('/entradas'))}
              className="text-bone/60 underline decoration-bone/30 underline-offset-4 hover:text-bone disabled:opacity-50"
            >
              Salir
            </button>
          </div>
        )}
        <Field label="Nombre y apellido" error={fieldError('name')}>
          <Input
            name="name"
            required
            autoComplete="name"
            defaultValue={account?.name}
            onChange={() => setEditedField('name')}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Cédula" hint="La vas a mostrar en puerta" error={ciError ?? fieldError('document')}>
            <Input
              name="document"
              required
              inputMode="numeric"
              autoComplete="off"
              defaultValue={account?.document}
              onChange={() => {
                setCiError(null);
                setEditedField('document');
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                setCiError(v && !validateCI(v) ? 'Cédula inválida: revisá los números y el dígito verificador.' : null);
              }}
            />
          </Field>
          <Field label="Celular (opcional)">
            <Input name="phone" type="tel" autoComplete="tel" defaultValue={account?.phone} />
          </Field>
        </div>
        {!account && (
          <>
            <Field label="Email" hint="Te mandamos la entrada acá" error={fieldError('email')}>
              <Input name="email" type="email" required autoComplete="email" onChange={() => setEditedField('email')} />
            </Field>
            <Field
              label="Creá una contraseña (opcional)"
              hint="Así guardamos tus datos para la próxima y ves tus entradas en Mi cuenta. Mínimo 8 caracteres."
              error={
                passwordError && state?.accountExists ? (
                  <>
                    Ya tenés cuenta con este email:{' '}
                    <Link href="/cuenta/ingresar?next=/entradas" className="font-medium text-bone underline underline-offset-4">
                      ingresá
                    </Link>
                    .
                  </>
                ) : (
                  passwordError
                )
              }
            >
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                onChange={() => setEditedField('password')}
              />
            </Field>
          </>
        )}
      </fieldset>

      {/* 3 · Código de descuento */}
      <div className="space-y-3">
        <input type="hidden" name="code" value={applied?.code ?? ''} />
        {applied ? (
          <div className="flex items-center justify-between gap-3 rounded-card border border-violet/40 bg-violet/10 px-4 py-3">
            <p className="text-sm">
              <span className="font-bold tracking-wide">{applied.code}</span>
              <span className="text-bone/70"> · {applied.label}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setApplied(null);
                setCodeInput('');
              }}
              className="inline-flex items-center gap-1 text-xs text-bone/60 hover:text-bone"
            >
              <X size={14} aria-hidden /> Quitar
            </button>
          </div>
        ) : codeOpen ? (
          <div className="space-y-2">
            <label htmlFor="codigo" className="text-[13px] font-medium text-bone/70">
              Código de descuento
            </label>
            <div className="flex gap-2">
              <Input
                id="codigo"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase());
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCode();
                  }
                }}
                autoCapitalize="characters"
                autoComplete="off"
                className="uppercase tracking-wide"
                aria-invalid={codeError ? true : undefined}
              />
              <Button type="button" variant="outline" onClick={applyCode} disabled={checking || !codeInput.trim()}>
                {checking ? 'Revisando...' : 'Aplicar'}
              </Button>
            </div>
            {(codeError ?? fieldError('code')) && (
              <p role="alert" className="text-xs text-alert">
                {codeError ?? fieldError('code')}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCodeOpen(true)}
            className="text-sm text-bone/70 underline decoration-bone/30 underline-offset-4 hover:text-bone"
          >
            ¿Tenés un código de descuento?
          </button>
        )}
      </div>

      {/* Transporte (opcional): va antes del pago para que el total a transferir ya lo incluya. */}
      {transport.length > 0 && (
        <fieldset ref={busRef} className="space-y-3">
          <legend className="mb-1 text-sm font-medium text-bone/70">¿Necesitás transporte?</legend>
          <p className="text-sm text-bone/55">La fiesta es fuera de Montevideo. Podés sumar tu lugar en el bus.</p>
          <div className="grid gap-3 pt-1">
            {[{ id: '', name: 'No, gracias', departure: '', price: 0, left: null }, ...transport].map((o) => {
              const full = o.left === 0 || goneBus.includes(o.id);
              const active = busId === o.id;
              return (
                <label
                  key={o.id || 'no'}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-card border px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bone/60',
                    full && 'cursor-not-allowed opacity-60',
                    active ? 'border-bone bg-bone/[0.06]' : 'border-bone/15 hover:border-bone/40',
                  )}
                >
                  <input
                    type="radio"
                    name="transport"
                    value={o.id}
                    checked={active}
                    disabled={full}
                    onChange={() => {
                      setBusId(o.id);
                      setEditedField('transport');
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-bone' : 'border-bone/40',
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-violet" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{o.name}</span>
                      {o.id && <span className="shrink-0 font-bold">{formatUYU(o.price)}</span>}
                    </span>
                    {o.departure && (
                      <span className="mt-1 block whitespace-pre-line text-sm leading-snug text-bone/65">{o.departure}</span>
                    )}
                    {(o.left !== null || full) && (
                      <span
                        className={cn(
                          'mt-2 block text-[11px] font-bold uppercase tracking-[0.12em]',
                          full ? 'text-alert' : 'text-bone/50',
                        )}
                      >
                        {full ? 'Sin lugares' : o.left === 1 ? 'Queda 1 lugar' : `Quedan ${o.left}`}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {fieldError('transport') && (
            <p role="alert" className="text-sm text-alert">
              {fieldError('transport')}
            </p>
          )}
        </fieldset>
      )}

      {/* 4 · Cómo pagar */}
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-bone/70">¿Cómo querés pagar?</legend>
        <input type="hidden" name="method" value={method} />
        <div className={cn('grid gap-3', bothMethods && 'sm:grid-cols-2')}>
          {methods.mercadopago && (
            <MethodCard
              active={method === 'mercadopago'}
              onSelect={() => setMethod('mercadopago')}
              title="Mercado Pago"
              body="Tarjeta, débito, saldo o efectivo. Tu entrada llega al instante."
              note="+ 7,5 % de cargo por servicio"
            />
          )}
          {methods.transfer && (
            <MethodCard
              active={method === 'transfer'}
              onSelect={() => setMethod('transfer')}
              title="Transferencia bancaria"
              body="Transferís y subís el comprobante. Te mandamos la entrada cuando lo validamos."
              note="Sin cargo por servicio"
            />
          )}
        </div>
        {fieldError('method') && <p className="text-sm text-alert">{fieldError('method')}</p>}

        {method === 'transfer' && price && (
          <div className="space-y-5 rounded-card border border-bone/10 bg-bone/[0.03] p-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-label text-bone/55">Cuenta para transferir</p>
                <CopyButton text={transferDetails} />
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-bone/85">{transferDetails}</pre>
            </div>
            <p className="text-sm text-bone/70">
              Transferí exactamente <strong className="text-bone">{formatUYU(price.total)}</strong> y subí el comprobante.
            </p>
            <div className="space-y-2">
              <span className="text-[13px] font-medium text-bone/70">Comprobante</span>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-control border border-dashed px-4 py-4 text-sm transition-colors',
                  receipt ? 'border-bone/40 text-bone' : 'border-bone/20 text-bone/60 hover:border-bone/40',
                )}
              >
                <FileUp size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate">
                  {receipt
                    ? `${receipt.name} · ${receipt.size < 1024 * 1024 ? `${Math.max(1, Math.round(receipt.size / 1024))} KB` : `${(receipt.size / 1024 / 1024).toFixed(1)} MB`}`
                    : 'Subí la foto o el PDF del comprobante'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  name="receipt"
                  accept={RECEIPT_ACCEPT}
                  required
                  onChange={onReceipt}
                  className="sr-only"
                />
              </label>
              {(receiptError ?? fieldError('receipt')) ? (
                <p role="alert" className="text-xs text-alert">
                  {receiptError ?? fieldError('receipt')}
                </p>
              ) : (
                <p className="text-xs text-bone/45">Foto, captura o PDF, hasta 4 MB.</p>
              )}
            </div>
          </div>
        )}
      </fieldset>

      {/* Resumen */}
      {tanda && price && (
        <dl className="space-y-2 rounded-card border border-bone/10 p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-bone/65">Entrada · {tanda.name}</dt>
            <dd>{formatUYU(price.price)}</dd>
          </div>
          {price.discount > 0 && applied && (
            <div className="flex justify-between">
              <dt className="text-bone/65">Descuento · {applied.code}</dt>
              <dd>−{formatUYU(price.discount)}</dd>
            </div>
          )}
          {bus && price.transport > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-bone/65">Transporte · {bus.name}</dt>
              <dd>{formatUYU(price.transport)}</dd>
            </div>
          )}
          {price.fee > 0 && (
            <div className="flex justify-between">
              <dt className="text-bone/65">Cargo por servicio</dt>
              <dd>{formatUYU(price.fee)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-bone/10 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatUYU(price.total)}</dd>
          </div>
        </dl>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-bone/70">
        <input type="checkbox" name="accept" className="mt-0.5 h-4 w-4 shrink-0 accent-bone" />
        <span>
          Entiendo que la entrada es personal e intransferible: una por persona, y en puerta me piden
          la cédula. Acepto los{' '}
          <a href="/terminos" className="underline decoration-bone/40 underline-offset-2 hover:text-bone">
            términos y condiciones
          </a>
          .
        </span>
      </label>
      {state && (!state.field || state.field === 'accept') && editedField === null && (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      )}
      <div className="space-y-3">
        <Submit method={method} total={price?.total ?? 0} />
        <p className="text-center text-xs text-bone/45">
          {method === 'transfer'
            ? 'Tu lugar queda reservado mientras validamos el comprobante. Te avisamos por mail.'
            : 'Tenés 20 minutos para completar el pago en Mercado Pago.'}
        </p>
      </div>
    </form>
  );
}

function MethodCard({
  active,
  onSelect,
  title,
  body,
  note,
}: {
  active: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'relative flex flex-col rounded-card border p-5 text-left transition-colors',
        active ? 'border-bone bg-bone/[0.06]' : 'border-bone/15 hover:border-bone/40',
      )}
    >
      <span className="text-base font-bold">{title}</span>
      <span className="mt-1.5 text-sm leading-snug text-bone/65">{body}</span>
      <span className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-bone/50">{note}</span>
      {active && <span aria-hidden className="absolute right-4 top-4 h-3 w-3 rounded-full bg-violet" />}
    </button>
  );
}
