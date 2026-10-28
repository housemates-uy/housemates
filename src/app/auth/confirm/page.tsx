import type { Metadata } from 'next';
import { SubmitButton } from '@/components/admin/submit-button';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Logo } from '@/components/ui/logo';
import { confirmLinkAction } from './actions';

export const metadata: Metadata = { title: 'Acceso', robots: { index: false, follow: false } };

// Destino de los links de invitación y de recuperación de contraseña:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite   (o type=recovery)
// Los de las cuentas de compradores (src/lib/customers.ts) traen además &next=/cuenta…
// El token se usa recién al tocar "Continuar" (POST). Así las vistas previas de
// WhatsApp o los escáneres de mail, que solo hacen GET, no gastan el link.
const COPY = {
  admin: { title: 'Acceso al admin', body: 'Tocá continuar para elegir tu contraseña.' },
  confirm: { title: 'Confirmá tu email', body: 'Tocá continuar para confirmar tu email y elegir tu contraseña.' },
  recovery: { title: 'Contraseña nueva', body: 'Tocá continuar para elegir tu contraseña nueva.' },
};

export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string; next?: string };
}) {
  const valid = !!searchParams.token_hash && !!searchParams.type;
  const next = searchParams.next?.startsWith('/cuenta') ? searchParams.next : null;
  const copy = !next ? COPY.admin : searchParams.type === 'recovery' ? COPY.recovery : COPY.confirm;

  return (
    <main id="contenido" className="relative isolate flex min-h-[100dvh] items-center justify-center overflow-hidden px-5 py-16">
      {next && <DoodleBackdrop className="-z-10" />}
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Logo className="h-20" />
        <h1 className="mt-10 text-2xl font-bold tracking-tight">{copy.title}</h1>
        {valid ? (
          <>
            <p className="mt-3 text-sm text-bone/60">{copy.body}</p>
            <form action={confirmLinkAction} className="mt-8 w-full">
              <input type="hidden" name="token_hash" value={searchParams.token_hash} />
              <input type="hidden" name="type" value={searchParams.type} />
              {next && <input type="hidden" name="next" value={next} />}
              <SubmitButton size="lg" className="w-full">
                Continuar
              </SubmitButton>
            </form>
          </>
        ) : (
          <p className="mt-3 text-sm text-bone/60">Este link está incompleto. Pedí uno nuevo.</p>
        )}
      </div>
    </main>
  );
}
