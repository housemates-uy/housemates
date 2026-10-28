import { cache } from 'react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Admin, Json } from '@/types/database';
import { isLocalNoAuth } from '@/lib/auth/local-mode';

// Owner de mentira para el modo local cuando no hay base (o no se pudo crear el de prueba).
const LOCAL_ADMIN: Admin = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'local@housemates.test',
  name: 'Local',
  role: 'owner',
  active: true,
  created_at: new Date(0).toISOString(),
  last_login_at: null,
};

// Modo local con `admins` sin nadie activo: crea un owner de prueba (usuario de Auth + fila
// en `admins`), porque check_ins, bar_scans y admin_logs tienen FK a `admins` y con un id
// inventado esos inserts fallan.
async function createLocalAdmin(db: ReturnType<typeof createAdminClient>): Promise<Admin | null> {
  const { email, name } = LOCAL_ADMIN;
  const { data: created } = await db.auth.admin.createUser({ email, email_confirm: true });
  // Si ya existía el usuario (p. ej. otra pestaña lo creó recién), se usa ese.
  const id = created.user?.id ?? (await db.rpc('find_auth_user', { p_email: email })).data?.[0]?.id;
  if (!id) return null;
  const { data } = await db
    .from('admins')
    .upsert({ id, email, name, role: 'owner', active: true })
    .select('*')
    .single();
  return data;
}

// Modo local sin claves: actúa como el primer owner activo de la base, así los
// admin_logs quedan a nombre de alguien real.
async function getLocalAdmin(): Promise<Admin> {
  try {
    const db = createAdminClient({ timeoutMs: 2500 });
    const { data, error } = await db.from('admins').select('*').eq('active', true);
    if (error) return LOCAL_ADMIN;
    if (data.length > 0) return data.find((a) => a.role === 'owner') ?? data[0];
    return (await createLocalAdmin(db)) ?? LOCAL_ADMIN;
  } catch {
    return LOCAL_ADMIN;
  }
}

// getUser() valida el JWT contra Supabase Auth (getSession() solo lee la cookie sin
// verificarla). `cache` lo deja en una sola llamada por request aunque lo pidan el layout,
// la página y las pestañas del evento.
export const getAdminUser = cache(async (): Promise<Admin | null> => {
  if (isLocalNoAuth()) return getLocalAdmin();

  // Sin conexión con Supabase no es "sesión vencida": se tira error, así la pantalla dice
  // "Sin conexión" y se puede reintentar (en la puerta, sin echar al portero).
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) {
    if (isAuthRetryableFetchError(authError)) throw new Error('Sin conexión con la base');
    return null;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('admins')
    .select('*')
    .eq('id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error('Sin conexión con la base');

  return data;
});

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdminUser();
  if (!admin) throw new Error('No autenticado');
  return admin;
}

export async function requireOwner(): Promise<Admin> {
  const admin = await requireAdmin();
  if (admin.role !== 'owner') throw new Error('Se requiere rol owner');
  return admin;
}

// Para comparar lo guardado con lo nuevo: la base devuelve "2026-12-11T23:00:00+00:00" y
// "00:30:00" donde el formulario manda "2026-12-11T23:00:00.000Z" y "00:30"; '' es vacío.
function comparable(value: unknown): unknown {
  if (value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return Date.parse(value);
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
  return value;
}

// Detalle para admin_logs: los campos de `after` que cambiaron, con el valor anterior y el
// nuevo ({ campo: { from, to } }). /admin/logs los muestra como "Campo: antes → después".
export function fieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: Json; to: Json }> {
  const changes: Record<string, { from: Json; to: Json }> = {};
  for (const [field, value] of Object.entries(after)) {
    if (comparable(before[field]) !== comparable(value)) {
      changes[field] = { from: (before[field] ?? null) as Json, to: (value ?? null) as Json };
    }
  }
  return changes;
}

// Registra una acción en admin_logs
export async function logAdminAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId?: string,
  diff?: Json
) {
  const db = createAdminClient();
  const { error } = await db.from('admin_logs').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    diff: diff ?? null,
  });
  // No corta la acción (ya se hizo), pero que no se pierda en silencio.
  if (error) console.error('[admin_logs] no se pudo registrar', action, entityType, error.message);
}
