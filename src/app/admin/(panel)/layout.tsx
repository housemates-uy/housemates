import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { MobileNav, Sidebar } from '@/components/admin/sidebar';
import { Header } from '@/components/admin/header';

export const metadata = { title: { default: 'Admin', template: '%s · Admin House Mates' } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) {
    // Sesión válida pero sin fila activa en `admins`: avisar en vez de mandar al login a ciegas.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? '/admin/login?error=noadmin' : '/admin/login');
  }

  // Transferencias esperando validación, para el contador de "A confirmar". El staff no ve
  // esa sección (null).
  let toConfirm: number | null = null;
  if (admin.role === 'owner') {
    const { count } = await createAdminClient()
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'review');
    toConfirm = count ?? 0;
  }

  return (
    <div className="min-h-[100dvh] md:pl-60">
      <Sidebar toConfirm={toConfirm} />
      <Header admin={admin} />
      <main id="contenido" className="px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
        {children}
      </main>
      <MobileNav toConfirm={toConfirm} />
    </div>
  );
}
