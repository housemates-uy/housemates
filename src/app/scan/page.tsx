import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DoorOpen, GlassWater, LogOut } from 'lucide-react';
import { logoutAction } from '@/app/admin/login/actions';
import { BarScannerApp } from '@/app/admin/barra/[id]/bar-scanner';
import { buttonVariants } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { getScanEvent, getScanUser } from '@/lib/auth/admin';
import { barCounts } from '@/lib/bar';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Escáner', robots: { index: false } };
export const dynamic = 'force-dynamic';

// housemates.uy/scan: la entrada de quien escanea en la fiesta.
//   - Usuario de barra: solo el escáner de barra de la fiesta que corresponde (getScanEvent).
//   - Owners y staff: links a la puerta y a la barra de esa fiesta.
// Sin sesión, el middleware manda al login del admin, que vuelve acá.
export default async function ScanHomePage() {
  const admin = await getScanUser();
  if (!admin) {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    redirect(user ? '/admin/login?error=noadmin&next=/scan' : '/admin/login?next=/scan');
  }

  const event = await getScanEvent();
  if (admin.role === 'barra' && event) {
    return <BarScannerApp eventId={event.id} title={event.title} initial={await barCounts(event.id)} exitHref={null} />;
  }

  return (
    <main id="contenido" className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-5 py-16">
      <div className="mb-10 flex flex-col items-center gap-4 text-center">
        <Logo className="h-16" />
        <h1 className="text-[11px] font-bold uppercase tracking-label text-bone/50">Escáner</h1>
        {event && <p className="text-lg font-bold tracking-tight">{event.title}</p>}
      </div>

      {!event ? (
        <p className="text-center text-sm leading-relaxed text-bone/65">
          No hay ninguna fiesta publicada en curso ni próxima.
        </p>
      ) : (
        <div className="grid gap-3">
          <Link href={`/admin/scan/${event.id}`} className={buttonVariants({ size: 'lg', className: 'h-16 w-full text-base' })}>
            <DoorOpen size={20} aria-hidden />
            Puerta
          </Link>
          <Link
            href={`/admin/barra/${event.id}`}
            className={buttonVariants({ size: 'lg', variant: 'outline', className: 'h-16 w-full text-base' })}
          >
            <GlassWater size={20} aria-hidden />
            Barra
          </Link>
        </div>
      )}

      <div className="mt-10 flex justify-center">
        {admin.role === 'barra' ? (
          <form action={logoutAction}>
            <button type="submit" className="inline-flex items-center gap-2 text-sm text-bone/55 hover:text-bone">
              <LogOut size={15} aria-hidden />
              Cerrar sesión
            </button>
          </form>
        ) : (
          <Link href="/admin" className="text-sm text-bone/55 underline-offset-4 hover:text-bone hover:underline">
            Ir al admin
          </Link>
        )}
      </div>
    </main>
  );
}
