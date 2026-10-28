'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  ScrollText,
  UserCog,
  LogOut,
} from 'lucide-react';
import { logoutAction } from '@/app/admin/login/actions';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Inicio', icon: LayoutDashboard, exact: true },
  { href: '/admin/events', label: 'Eventos', icon: CalendarDays },
  { href: '/admin/whitelist', label: 'Whitelist', icon: Users },
  { href: '/admin/admins', label: 'Admins', icon: UserCog },
  { href: '/admin/config', label: 'Config', icon: Settings },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const isActive = useIsActive();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-bone/10 bg-ink md:flex">
      <Link href="/admin" className="flex items-center gap-3 px-6 py-6" aria-label="House Mates admin">
        <Logo className="h-11" />
        <span className="text-[11px] font-bold uppercase tracking-label text-bone/45">Admin</span>
      </Link>

      <nav aria-label="Admin" className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors',
                active ? 'bg-bone/10 font-medium text-bone' : 'text-bone/55 hover:bg-bone/5 hover:text-bone',
              )}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="border-t border-bone/10 p-3">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm text-bone/55 transition-colors hover:bg-bone/5 hover:text-bone"
        >
          <LogOut size={16} strokeWidth={1.5} aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}

export function MobileNav() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-bone/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors',
              active ? 'font-medium text-bone' : 'text-bone/50',
            )}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
