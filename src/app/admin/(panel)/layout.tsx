import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import { MobileNav, Sidebar } from '@/components/admin/sidebar';
import { Header } from '@/components/admin/header';

export const metadata = { title: { default: 'Admin', template: '%s · Admin House Mates' } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');

  return (
    <div className="min-h-[100dvh] md:pl-60">
      <Sidebar />
      <Header admin={admin} />
      <main id="contenido" className="px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
