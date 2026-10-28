import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/gate';
import { getCustomer } from '@/lib/customers';
import { AuthShell } from '../auth-shell';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Ingresar', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function IngresarPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const next = safeNextPath(searchParams.next, '/cuenta');
  if (await getCustomer()) redirect(next);

  return (
    <AuthShell title="Mi cuenta" intro="Ingresá para ver tus entradas y comprar con tus datos guardados.">
      <SignInForm next={next} linkExpired={searchParams.error === 'link'} />
      <p className="mt-10 text-center text-xs leading-relaxed text-bone/45">
        ¿Todavía no tenés cuenta? Se crea cuando comprás tu entrada: elegís una contraseña en el
        formulario.
      </p>
    </AuthShell>
  );
}
