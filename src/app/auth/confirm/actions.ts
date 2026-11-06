'use server';

import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Admins: invitación o recupero → eligen contraseña en /admin/account.
// Compradores (los links que arma src/lib/customers.ts traen `next`): "Confirmá tu email" y
// recupero → /cuenta/nueva-clave. El email no se marca verificado acá sino al guardar la
// contraseña (updatePasswordAction): marcado acá, seguiría valiendo la contraseña de quien
// creó la cuenta, que puede no ser el dueño del email.
const ADMIN_TYPES: EmailOtpType[] = ['invite', 'recovery'];
const CUSTOMER_TYPES: EmailOtpType[] = ['magiclink', 'recovery'];
// '/cuenta' lo traen los mails de "Confirmá tu email" mandados antes de este cambio.
const CUSTOMER_NEXT = ['/cuenta', '/cuenta/nueva-clave'];

export async function confirmLinkAction(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const type = String(formData.get('type') ?? '') as EmailOtpType;
  const next = String(formData.get('next') ?? '');
  const forCustomer = CUSTOMER_NEXT.includes(next);

  if (tokenHash && (forCustomer ? CUSTOMER_TYPES : ADMIN_TYPES).includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Quien abrió el link es el dueño del email: la contraseña anterior (que pudo poner otro
      // al crear la cuenta con este email) deja de valer y se cierran las otras sesiones. La
      // nueva la elige en la pantalla siguiente.
      const { error: resetError } = await supabase.auth.updateUser({ password: randomBytes(24).toString('base64url') });
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (resetError || signOutError) {
        console.error('[auth/confirm] no se pudo invalidar el acceso anterior', resetError?.message ?? signOutError?.message);
      }
      if (!forCustomer) redirect('/admin/account?set=1');
      redirect(type === 'magiclink' ? '/cuenta/nueva-clave?confirmar=1' : '/cuenta/nueva-clave');
    }
  }

  redirect(forCustomer ? '/cuenta/ingresar?error=link' : '/admin/login?error=link');
}
