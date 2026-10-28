'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function TabLinkClient({
  href,
  label,
  exact,
}: {
  href: string;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        '-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors',
        isActive
          ? 'border-bone font-medium text-bone'
          : 'border-transparent text-bone/50 hover:text-bone',
      )}
    >
      {label}
    </Link>
  );
}
