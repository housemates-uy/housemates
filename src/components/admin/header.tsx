import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { logoutAction } from '@/app/admin/login/actions';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/ui/logo';
import type { Admin } from '@/types/database';

export function Header({ admin }: { admin: Admin }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-bone/10 bg-ink/95 px-4 backdrop-blur md:justify-end md:px-8">
      <Link href="/admin" className="md:hidden" aria-label="House Mates admin">
        <Logo className="h-9" />
      </Link>
      <div className="flex items-center gap-3">
        <Badge tone={admin.role === 'owner' ? 'solid' : 'neutral'}>{admin.role}</Badge>
        <span className="text-sm text-bone/75">{admin.name}</span>
        <form action={logoutAction} className="md:hidden">
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="flex h-10 w-10 items-center justify-center rounded-control text-bone/55 hover:bg-bone/5 hover:text-bone"
          >
            <LogOut size={17} strokeWidth={1.5} aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
