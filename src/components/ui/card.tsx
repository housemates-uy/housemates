import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-bone/10 bg-bone/[0.03] p-5', className)} {...props} />;
}

export function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <p className="text-[13px] text-bone/50">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-bone">{value}</p>
      {sub && <p className="mt-1 text-xs text-bone/45">{sub}</p>}
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-bone/15 px-6 py-14 text-center">
      <p className="text-sm font-medium text-bone/80">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-bone/45">{children}</div>}
    </div>
  );
}
