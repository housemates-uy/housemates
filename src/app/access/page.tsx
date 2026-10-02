import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { hasGateAccess, safeNextPath } from '@/lib/auth/gate';
import { getIgHandle, igUrl } from '@/lib/site';
import { AccessForm } from './access-form';

export const metadata: Metadata = { title: 'Acceso' };
export const dynamic = 'force-dynamic';

export default async function AccessPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNextPath(searchParams.next);
  if (await hasGateAccess()) redirect(next);

  const igHandle = await getIgHandle();

  return (
    <main id="contenido" className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden">
      <DoodleBackdrop className="-z-10" />

      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <AccessForm next={next} />
        </div>
      </div>

      <footer className="flex items-center justify-between px-5 py-6 text-sm text-bone/55 md:px-10">
        <Link href="/" className="transition-colors hover:text-bone">
          Volver al inicio
        </Link>
        <a href={igUrl(igHandle)} target="_blank" rel="noreferrer" className="transition-colors hover:text-bone">
          {igHandle}
        </a>
      </footer>
    </main>
  );
}
