import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { formatLocal } from '@/lib/events';
import { GatePasswordForm } from './gate-password-form';

export const metadata = { title: 'Configuración' };

export default async function ConfigPage() {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const { data: gateConfig } = await db
    .from('site_config')
    .select('value, updated_at')
    .eq('key', 'gate_password')
    .maybeSingle();

  const isOwner = admin.role === 'owner';

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Configuración" description="Ajustes generales del sitio" />

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Contraseña del gate</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-bone/55">
            Es la que se pide para entrar a la compra de entradas. Al cambiarla, quienes ya habían
            entrado tienen que ingresar la nueva.
          </p>
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          {gateConfig?.value ? (
            <>
              <span className="text-sm tracking-[0.3em] text-bone/60" aria-label="Contraseña oculta">
                ••••••••
              </span>
              <span className="text-xs text-bone/50">
                Último cambio: {formatLocal(gateConfig.updated_at, "d MMM yyyy 'a las' HH:mm")}
              </span>
            </>
          ) : (
            <p className="text-sm text-bone/60">
              Sin contraseña configurada. Se usa la variable de entorno <code>GATE_PASSWORD</code>.
            </p>
          )}
        </Card>

        {isOwner ? (
          <GatePasswordForm />
        ) : (
          <p className="text-sm text-bone/55">Solo los owners pueden cambiar la contraseña.</p>
        )}
      </section>
    </div>
  );
}
