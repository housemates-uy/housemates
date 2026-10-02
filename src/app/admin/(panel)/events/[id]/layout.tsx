import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAdminUser } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { TabLinkClient } from '@/components/admin/tab-link';

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');

  const db = createAdminClient();
  const { data: event } = await db
    .from('events')
    .select('id, title, status')
    .eq('id', params.id)
    .single();

  if (!event) notFound();

  const tabs = [
    { href: `/admin/events/${params.id}`, label: 'Resumen', exact: true },
    { href: `/admin/events/${params.id}/tickets`, label: 'Tickets' },
    { href: `/admin/events/${params.id}/invitations`, label: 'Invitaciones' },
    { href: `/admin/events/${params.id}/scan`, label: 'Scanner' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-sm text-bone/55 hover:text-bone"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Eventos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{event.title}</h1>
      </div>

      <nav aria-label="Secciones del evento" className="flex overflow-x-auto border-b border-bone/10">
        {tabs.map((tab) => (
          <TabLinkClient key={tab.href} href={tab.href} label={tab.label} exact={tab.exact} />
        ))}
      </nav>

      {children}
    </div>
  );
}
