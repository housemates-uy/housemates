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
  if (error) return { error: 'No se pudo guardar la contraseña. Probá de nuevo.' };

  return { ok: true };
}
