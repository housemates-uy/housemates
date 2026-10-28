'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';

const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres');

export async function updatePasswordAction(
  password: string,
): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  // Repetir la misma vale: así se puede reintentar si falló el cierre de las otras sesiones.
  if (error && error.code !== 'same_password') {
    return { error: 'No se pudo guardar la contraseña. Probá de nuevo.' };
  }

  // Las otras sesiones dejan de valer: por ejemplo, la de alguien que creó el usuario de Auth
  // con este email antes del alta como admin.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
  if (signOutError) {
    return { error: 'Se guardó la contraseña, pero no se pudieron cerrar las otras sesiones. Probá de nuevo.' };
  }

  return { ok: true };
}
