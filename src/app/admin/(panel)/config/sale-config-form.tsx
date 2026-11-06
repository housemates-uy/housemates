'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/admin/submit-button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { SERVICE_FEE_LABEL } from '@/lib/pricing';
import { MAX_PER_ORDER_LIMIT } from '@/lib/order-limits';
import { saveSaleConfigAction, type SaleConfigState } from './actions';

type Values = {
  mpEnabled: boolean;
  transferEnabled: boolean;
  transferDetails: string;
  maxPerOrder: number;
};

function Toggle({ name, label, hint, defaultChecked, disabled }: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 accent-bone"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-bone/55">{hint}</span>
      </span>
    </label>
  );
}

export function SaleConfigForm({
  values,
  mpConfigured,
  editable,
  saved,
}: {
  values: Values;
  mpConfigured: boolean;
  editable: boolean;
  saved: boolean;
}) {
  const [state, action] = useFormState<SaleConfigState, FormData>(saveSaleConfigAction, null);

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!editable} className="space-y-5">
        <Toggle
          name="pay_mp_enabled"
          label="Mercado Pago"
          hint={
            mpConfigured
              ? `Tarjeta de débito o crédito, con ${SERVICE_FEE_LABEL} de cargo por servicio. La entrada llega al instante.`
              : 'Todavía no está conectado (falta MP_ACCESS_TOKEN): se muestra en la compra, pero avisa que se habilita pronto y no cobra.'
          }
          defaultChecked={values.mpEnabled}
        />
        <Toggle
          name="pay_transfer_enabled"
          label="Transferencia bancaria"
          hint="Sin cargo por servicio. La persona sube el comprobante y lo validan en Entradas."
          defaultChecked={values.transferEnabled}
        />
        <Field label="Datos para transferir" hint="Banco, titular, tipo y número de cuenta. Se muestran tal cual, con un botón para copiarlos.">
          <Textarea name="transfer_details" rows={5} defaultValue={values.transferDetails} placeholder={'BROU · Caja de ahorro en pesos\nTitular: ...\nCuenta: ...'} />
        </Field>
        <Field
          label="Máximo de entradas por compra"
          hint="La de quien compra más las de sus amigos, cada una a nombre de una persona. De 1 a 10: con 1 se compra solo la propia."
        >
          <Input
            type="number"
            name="max_tickets_per_order"
            inputMode="numeric"
            min={1}
            max={MAX_PER_ORDER_LIMIT}
            step={1}
            required
            defaultValue={values.maxPerOrder}
            className="w-28"
          />
        </Field>
      </fieldset>

      {editable && (
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton variant="outline">Guardar</SubmitButton>
          {saved && !state && (
            <p role="status" className="text-sm text-bone/75">
              Guardado.
            </p>
          )}
          {state && (
            <p role="alert" className="text-sm text-alert">
              {state.error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
