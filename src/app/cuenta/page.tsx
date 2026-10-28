import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/card';
import { DoodleBackdrop } from '@/components/ui/doodle-backdrop';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Logo } from '@/components/ui/logo';
import { getCustomer, loadAccountTickets, type AccountTicket } from '@/lib/customers';
import { formatDocument } from '@/lib/tickets';
import { getTransportByTicket, type TicketTransport } from '@/lib/transport';
import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/database';
import { signOutAction } from './actions';
import { ProfileForm, ResendConfirm } from './account-forms';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const DOT: Record<TicketStatus, string> = {
  paid: 'bg-violet',
  review: 'bg-bone/50',
  pending: 'bg-bone/50',
  used: 'bg-bone/30',
  cancelled: 'bg-alert',
  refunded: 'bg-alert',
};

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: { clave?: string; confirmado?: string };
}) {
  const customer = await getCustomer();
  if (!customer) redirect('/cuenta/ingresar?next=/cuenta');

  const tickets = await loadAccountTickets(customer);
  const buses = await getTransportByTicket({ ticketIds: tickets.map((t) => t.id) });
  const upcoming = tickets.filter((t) => t.upcoming);
  const past = tickets.filter((t) => !t.upcoming);
  const firstName = customer.profile?.name.split(' ')[0];
  const notice =
    searchParams.clave === '1'
      ? 'Listo: guardamos tu contraseña nueva.'
      : searchParams.confirmado === '1'
        ? 'Listo: guardamos tu contraseña y confirmamos tu email. Ya ves todas las entradas a tu nombre.'
        : null;

  return (
    // Mismo fondo que /entradas: doodle desenfocado, fijo al hacer scroll.
    <div className="relative isolate min-h-[100dvh]">
      <DoodleBackdrop className="fixed -z-10" />
      <main id="contenido" className="mx-auto min-h-[100dvh] max-w-3xl px-5 pb-20 md:px-10">
        <header className="flex h-20 items-center justify-between">
          <Link href="/" aria-label="House Mates, inicio" className="p-2">
            <Logo className="h-11" />
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/entradas" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Entradas
            </Link>
            <form action={signOutAction.bind(null, '/')}>
              <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Salir
              </button>
            </form>
          </div>
        </header>

        <section className="pt-10">
          <Eyebrow>Mi cuenta</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.75rem,11vw,5rem)] font-bold leading-[0.9] tracking-[-0.04em]">
            {firstName ? `Hola, ${firstName}` : 'Tu cuenta'}
          </h1>
          <p className="mt-4 break-all text-sm text-bone/60">{customer.email}</p>
        </section>

        {notice && (
          <p role="status" className="mt-8 rounded-card border border-violet/40 bg-violet/10 px-4 py-3 text-sm">
            {notice}
          </p>
        )}

        <section aria-labelledby="mis-entradas" className="mt-12">
          <h2 id="mis-entradas" className="text-xl font-bold tracking-tight">
            Mis entradas
          </h2>

          {tickets.length === 0 ? (
            <div className="mt-5">
              <EmptyState title="Todavía no tenés entradas">
                Cuando compres, tu entrada aparece acá además de llegarte por mail.
              </EmptyState>
              <Link href="/entradas" className={buttonVariants({ size: 'lg', className: 'mt-5 w-full sm:w-auto' })}>
                Comprar entrada
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-8">
              {upcoming.length > 0 && <TicketList title="Próximas" items={upcoming} buses={buses} />}
              {past.length > 0 && <TicketList title="Pasadas" items={past} buses={buses} />}
            </div>
          )}

          {!customer.verified && customer.profile && (
            <div className="mt-8 rounded-card border border-bone/10 bg-ink/40 p-5">
              <p className="text-sm font-medium">¿Te falta alguna entrada?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-bone/60">
                Acá ves las que compraste con tu cuenta. Para ver también las que se compraron o te
                mandaron a <span className="break-all text-bone/85">{customer.email}</span> (por
                ejemplo, una invitación), confirmá tu email con el link que te mandamos.
              </p>
              <ResendConfirm />
            </div>
          )}
        </section>

        <section aria-labelledby="tus-datos" className="mt-14">
          <h2 id="tus-datos" className="text-xl font-bold tracking-tight">
            Tus datos
          </h2>
          <p className="mt-2 text-sm text-bone/60">Los usamos para completar el formulario cuando comprás.</p>
          <Card className="mt-5 p-6 md:p-8">
            {customer.profile ? (
              <ProfileForm
                name={customer.profile.name}
                phone={customer.profile.phone ?? ''}
                document={formatDocument(customer.profile.document)}
                email={customer.email}
              />
            ) : (
              <p className="text-sm text-bone/65">Tus datos se guardan con tu primera compra con la cuenta.</p>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}

function TicketList({
  title,
  items,
  buses,
}: {
  title: string;
  items: AccountTicket[];
  buses: Map<string, TicketTransport>;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-label text-bone/45">{title}</p>
      <ul className="mt-3 space-y-3">
        {items.map((t) => (
          <li key={t.id}>
            <Card className={cn('p-5 md:p-6', !t.upcoming && 'opacity-80')}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <p className="text-[clamp(2rem,9vw,2.75rem)] font-bold leading-none tracking-[-0.04em]">{t.dateShort}</p>
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]">
                  <span aria-hidden className={cn('h-2 w-2 rounded-full', DOT[t.status])} />
                  {t.statusLabel}
                </span>
              </div>
              <p className="mt-3 text-sm text-bone/75">{t.dateLabel}</p>
              <p className="mt-1 text-sm text-bone/55">
                {t.eventTitle} · {t.entryLabel}
              </p>
              <BusLine bus={buses.get(t.id)} />
              {t.href && (
                <Link
                  href={t.href}
                  className={buttonVariants({
                    variant: t.status === 'paid' ? 'solid' : 'outline',
                    className: 'mt-5 w-full sm:w-auto',
                  })}
                >
                  Ver entrada
                </Link>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BusLine({ bus }: { bus?: TicketTransport }) {
  if (!bus) return null;
  return (
    <p className="mt-1 whitespace-pre-line text-sm text-bone/55">
      Bus · {bus.name} · {bus.departure}
    </p>
  );
}
