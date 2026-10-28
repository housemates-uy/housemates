'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/admin/submit-button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { saveSaleConfigAction, type SaleConfigState } from './actions';

type Values = {
  gateEnabled: boolean;
  mpEnabled: boolean;
  transferEnabled: boolean;
  transferDetails: string;
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

export function SaleConfigForm({ values, mpConfigured, editable }: { values: Values; mpConfigured: boolean; editable: boolean }) {
  const [state, action] = useFormState<SaleConfigState, FormData>(saveSaleConfigAction, null);

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!editable} className="space-y-5">
        <Toggle
          name="gate_enabled"
          label="Pedir contraseña para comprar"
          hint="Apagado: cualquiera con el link puede comprar. Prendido: pide la contraseña de abajo."
          defaultChecked={values.gateEnabled}
        />
        <Toggle
          name="pay_mp_enabled"
          label="Mercado Pago"
          hint={
            mpConfigured
              ? 'Tarjeta, débito, saldo o efectivo, con 7,5 % de cargo por servicio. La entrada llega al instante.'
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
      </fieldset>

      {editable && (
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton variant="outline">Guardar</SubmitButton>
          {state && 'ok' in state && (
            <p role="status" className="text-sm text-bone/75">
              Guardado.
            </p>
          )}
          {state && 'error' in state && (
            <p role="alert" className="text-sm text-alert">
              {state.error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
