import type { Metadata } from 'next';
import { AuthShell } from '../auth-shell';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Recuperar contraseña', robots: { index: false, follow: false } };

export default function RecuperarPage() {
  return (
    <AuthShell title="Recuperar contraseña" intro="Te mandamos un link a tu email para elegir una contraseña nueva.">
      <ResetForm />
    </AuthShell>
  );
}
