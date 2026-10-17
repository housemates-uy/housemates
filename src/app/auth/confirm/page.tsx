import type { Metadata } from 'next';
import { SubmitButton } from '@/components/admin/submit-button';
import { Logo } from '@/components/ui/logo';
import { confirmLinkAction } from './actions';

export const metadata: Metadata = { title: 'Acceso al admin' };

// Destino de los links de invitación y de recuperación de contraseña:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite   (o type=recovery)
// El token se usa recién al tocar "Continuar" (POST). Así las vistas previas de
// WhatsApp o los escáneres de mail, que solo hacen GET, no gastan el link.
export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string };
}) {
  const valid = !!searchParams.token_hash && !!searchParams.type;

  return (
    <main id="contenido" className="flex min-h-[100dvh] items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Logo className="h-20" />
        <h1 className="mt-10 text-2xl font-bold tracking-tight">Acceso al admin</h1>
        {valid ? (
          <>
            <p className="mt-3 text-sm text-bone/60">Tocá continuar para elegir tu contraseña.</p>
            <form action={confirmLinkAction} className="mt-8 w-full">
              <input type="hidden" name="token_hash" value={searchParams.token_hash} />
              <input type="hidden" name="type" value={searchParams.type} />
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
