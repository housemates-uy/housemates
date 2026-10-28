import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Admin, Json } from '@/types/database';

export async function getAdminUser(): Promise<Admin | null> {
  const supabase = await createClient();
  // getSession() avoids a redundant network call to Supabase Auth.
  // The middleware already runs getUser() (which does the real verification)
  // on every request before Server Actions execute — so the session here is safe.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const db = createAdminClient();
  const { data } = await db
    .from('admins')
    .select('*')
    .eq('id', session.user.id)
    .eq('active', true)
    .single();

  return data ?? null;
}

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

// Registra una acción en admin_logs
export async function logAdminAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId?: string,
  diff?: Json
) {
  const db = createAdminClient();
  await db.from('admin_logs').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    diff: diff ?? null,
  });
}
