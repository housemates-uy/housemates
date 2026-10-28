'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  TicketCheck,
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
  {
    href: '/admin/confirmar',
    label: 'A confirmar',
    short: 'Confirmar',
    icon: TicketCheck,
    ownerOnly: true,
  },
  { href: '/admin/whitelist', label: 'Whitelist', icon: Users },
  { href: '/admin/admins', label: 'Administradores', short: 'Admins', icon: UserCog },
  { href: '/admin/config', label: 'Configuración', short: 'Config', icon: Settings },
  { href: '/admin/logs', label: 'Historial', icon: ScrollText },
];

// toConfirm: compras por transferencia esperando validación. null = staff, que no ve "A confirmar".
type NavProps = { toConfirm: number | null };

function navItems(toConfirm: number | null) {
  return NAV.filter((item) => !item.ownerOnly || toConfirm !== null);
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function PendingCount({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[11px] font-bold tabular-nums leading-none text-ink',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}

export function Sidebar({ toConfirm }: NavProps) {
  const isActive = useIsActive();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-bone/10 bg-ink md:flex">
      <Link href="/admin" className="flex items-center gap-3 px-6 py-6" aria-label="House Mates admin">
        <Logo className="h-11" />
        <span className="text-[11px] font-bold uppercase tracking-label text-bone/45">Admin</span>
      </Link>

      <nav aria-label="Admin" className="flex-1 space-y-1 px-3 py-2">
        {navItems(toConfirm).map(({ href, label, icon: Icon, exact, ownerOnly }) => {
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
              {ownerOnly && !!toConfirm && <PendingCount count={toConfirm} className="ml-auto" />}
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

export function MobileNav({ toConfirm }: NavProps) {
  const isActive = useIsActive();
  const items = navItems(toConfirm);

  return (
    <nav
      aria-label="Admin"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 grid border-t border-bone/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden',
        items.length > 6 ? 'grid-cols-7' : 'grid-cols-6',
      )}
    >
      {items.map(({ href, label, short, icon: Icon, exact, ownerOnly }) => {
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
            <span className="relative">
              <Icon size={18} strokeWidth={1.5} aria-hidden />
              {ownerOnly && !!toConfirm && (
                <PendingCount count={toConfirm} className="absolute -right-3 -top-2" />
              )}
            </span>
            {short ?? label}
          </Link>
        );
      })}
    </nav>
  );
}
