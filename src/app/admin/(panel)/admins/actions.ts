'use server';

// Usuarios de barra: solo el escáner de barra en /scan (src/lib/auth/admin.ts). Los crea un
// owner con email, nombre y contraseña, y se los pasa a los barmans. Owners y staff se siguen
// dando de alta desde Supabase (docs/EXTERNAL_SERVICES.md).
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAdminAction, requireOwner } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/lib/validation/email';

export type BarUserFormState = { error: string; field?: string } | { ok: true; email: string } | null;

const schema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre').max(60, 'Hasta 60 letras'),
  email: z.string().trim().toLowerCase().refine(isValidEmail, 'Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Hasta 72 caracteres'),
});

const FAILED = 'No se pudo crear el usuario. Probá de nuevo.';

export async function createBarUserAction(formData: FormData): Promise<BarUserFormState> {
  const admin = await requireOwner().catch(() => null);
  if (!admin) return { error: 'Solo los owners pueden crear usuarios.' };

  const parsed = schema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const d = parsed.data;
  const db = createAdminClient();

  // Compradores y admins comparten Supabase Auth: un email que ya tiene usuario puede ser la
  // cuenta de otra persona, que seguiría entrando con su contraseña. No se reusa.
  const { data: existing, error: findError } = await db.rpc('find_auth_user', { p_email: d.email });
  if (findError) return { error: FAILED };
  if (existing?.length) {
    return { error: 'Ese email ya tiene un usuario. Usá otro, por ejemplo barra@ y el dominio de la fiesta.', field: 'email' };
  }

  const { data: created, error } = await db.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
  });
  if (error || !created.user) {
    return error?.code === 'weak_password'
      ? { error: 'Esa contraseña es muy fácil: probá con otra más larga.', field: 'password' }
      : { error: FAILED };
  }

  const { error: insertError } = await db
    .from('admins')
    .insert({ id: created.user.id, email: d.email, name: d.name, role: 'barra', active: true });
  if (insertError) {
    await db.auth.admin.deleteUser(created.user.id);
    return { error: FAILED };
  }

  await logAdminAction(admin.id, 'create_bar_user', 'admin', created.user.id, { email: d.email, name: d.name });
  revalidatePath('/admin/admins');
  return { ok: true, email: d.email };
}
