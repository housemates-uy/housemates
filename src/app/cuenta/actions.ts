'use server';

// Cuentas de compradores. Ver docs/LOGICA_DE_NEGOCIO.md → "Cuentas de compradores".
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safeNextPath } from '@/lib/auth/gate';
import { allowAttempt, TOO_MANY_ATTEMPTS } from '@/lib/rate-limit';
import {
  getCustomer,
  markEmailVerified,
  openedFromEmailLink,
  passwordSchema,
  sendAccountConfirmMail,
  sendPasswordResetMail,
} from '@/lib/customers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/validation/email';

export type FormState = { error?: string; ok?: string } | null;

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!isValidEmail(email) || !password) return { error: 'Completá tu email y tu contraseña.' };
  if (!(await allowAttempt('login'))) return { error: TOO_MANY_ATTEMPTS };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.status === 429
          ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
          : 'Email o contraseña incorrectos.',
    };
  }
  redirect(safeNextPath(String(formData.get('next') ?? ''), '/cuenta'));
}

// "Salir" cierra solo la sesión de este navegador.
export async function signOutAction(next: string) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(safeNextPath(next, '/'));
}

// Tarda siempre lo mismo y responde igual exista o no la cuenta: así no se puede averiguar
// quién tiene cuenta. Pasado el límite tampoco cambia la respuesta (no se manda nada).
const RESET_MIN_MS = 1500;

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!isValidEmail(email)) return { error: 'Escribí un email válido.' };
  const started = Date.now();
  if (await allowAttempt('reset')) await sendPasswordResetMail(email);
  const wait = RESET_MIN_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return { ok: email };
}

// Solo con la sesión que abrió un link del mail (/auth/confirm): "Confirmá tu email" o
// recupero. Guardar la contraseña con esa sesión es lo que prueba que el email es suyo.
export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(String(formData.get('password') ?? ''));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await openedFromEmailLink(supabase))) redirect('/cuenta/recuperar');

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  // Repetir la que ya tenía vale (la sabe y el link prueba que el email es suyo); así también
  // se puede reintentar si antes falló el cierre de sesiones.
  if (error && error.code !== 'same_password') return { error: 'No pudimos guardar la contraseña. Probá de nuevo.' };

  // Primero quedan afuera las otras sesiones (la de quien creó la cuenta con este email, si
  // no era el dueño) y recién después se suman las entradas del email.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
  if (signOutError) return { error: 'No pudimos guardar la contraseña. Probá de nuevo.' };
  redirect((await markEmailVerified(user.id)) ? '/cuenta?confirmado=1' : '/cuenta?clave=1');
}

const profileSchema = z.object({
  name: z.string().trim().min(3, 'Poné nombre y apellido.'),
  phone: z.string().trim().max(30, 'Ese celular es muy largo.'),
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) redirect('/cuenta/ingresar?next=/cuenta');
  if (!customer.profile) return { error: 'Tus datos se guardan con tu primera compra.' };

  const parsed = profileSchema.safeParse({ name: formData.get('name') ?? '', phone: formData.get('phone') ?? '' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await createAdminClient()
    .from('customers')
    .update({ name: parsed.data.name, phone: parsed.data.phone || null })
    .eq('id', customer.id);
  if (error) return { error: 'No pudimos guardar los cambios. Probá de nuevo.' };
  // Sin revalidatePath: recargar /cuenta reiniciaba el formulario y se perdía el "Guardado.".
  // Los campos ya muestran lo que escribió; el saludo se actualiza en la próxima visita.
  return { ok: 'Guardado.' };
}

export async function resendConfirmAction(): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) redirect('/cuenta/ingresar?next=/cuenta');
  if (customer.verified) return { ok: 'Tu email ya está confirmado.' };
  if (!(await allowAttempt('reset'))) return { error: TOO_MANY_ATTEMPTS };

  const sent = await sendAccountConfirmMail(customer.email, customer.profile?.name ?? '');
  return sent
    ? { ok: `Te mandamos el link a ${customer.email}. Revisá también spam.` }
    : { error: 'No pudimos mandarlo ahora. Si recién pediste uno, esperá un minuto y probá de nuevo.' };
}
