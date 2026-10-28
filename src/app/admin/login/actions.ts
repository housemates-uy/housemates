'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Email o contraseña incorrectos' };
  }

  const db = createAdminClient();
  await db
    .from('admins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id);

  redirect('/admin');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

export async function requestPasswordResetAction(email: string): Promise<{ ok: true }> {
  const supabase = await createClient();
  // Siempre responde ok: no revela si el email existe.
  await supabase.auth.resetPasswordForEmail(email);
  return { ok: true };
}
