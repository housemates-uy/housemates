import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download } from 'lucide-react';
import { getAdminUser } from '@/lib/auth/admin';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, StatCard } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatLocal } from '@/lib/events';
import { getBuyers, matchesSearch } from './buyers';

export const metadata = { title: 'Compradores' };

// La lista entera puede ser de miles: se muestran las primeras y el resto se encuentra buscando.
const SHOWN = 300;

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString('es-UY')} ${n === 1 ? one : many}`;
}

// Base de compradores para mailing (ADR #038). Solo owners: son los datos de todos los que
// compraron. Es de solo lectura: no manda mails ni carga nada en la whitelist.
export default async function BuyersPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');
  if (admin.role !== 'owner') redirect('/admin');

  const buyers = await getBuyers();
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim().slice(0, 100) : '';
  const found = q ? buyers.filter((b) => matchesSearch(b, q)) : buyers;
  const unsubscribed = buyers.filter((b) => b.unsubscribed).length;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Compradores"
        description="Un email por persona, sacado de las entradas pagas o usadas de todas las fiestas. Es la base para el mailing: desde acá no se manda nada."
        action={
          <a href="/admin/compradores/csv" className={buttonVariants({ size: 'sm' })}>
            <Download size={14} strokeWidth={1.5} aria-hidden />
            Descargar CSV
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Emails" value={buyers.length.toLocaleString('es-UY')} sub="Uno por persona" />
        <StatCard label="En el CSV" value={(buyers.length - unsubscribed).toLocaleString('es-UY')} sub="Todos menos las bajas" />
        <StatCard
          label="Bajas"
          value={unsubscribed.toLocaleString('es-UY')}
          sub="Pidieron no recibir más mails: quedan afuera del CSV"
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            {q ? `${plural(found.length, 'resultado', 'resultados')} de ${buyers.length.toLocaleString('es-UY')}` : 'Todos'}
          </h2>
          <form className="w-full sm:w-72">
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre o email"
              aria-label="Buscar compradores"
            />
          </form>
        </div>

        {found.length === 0 ? (
          <EmptyState title={q ? 'Sin resultados' : 'Todavía no hay compradores'}>
            {q ? (
              <Link href="/admin/compradores" className="underline">
                Limpiar búsqueda
              </Link>
            ) : (
              'Aparecen acá cuando alguien tiene una entrada paga o usada.'
            )}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-bone/10 rounded-card border border-bone/10">
            {found.slice(0, SHOWN).map((b) => (
              <li
                key={b.emailNormalized}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{b.name}</p>
                    {b.unsubscribed && <Badge tone="alert">Baja</Badge>}
                  </div>
                  <p className="mt-0.5 break-all text-xs text-bone/55">{b.email}</p>
                </div>
                <div className="text-xs sm:text-right">
                  <p className="text-bone/75">
                    {b.lastEvent.title} · {formatLocal(b.lastEvent.date, 'd/MM/yyyy')}
                  </p>
                  <p className="mt-0.5 text-bone/45">{plural(b.events, 'fiesta', 'fiestas')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {found.length > SHOWN && (
          <p className="text-xs text-bone/45">
            Se muestran {SHOWN} de {found.length.toLocaleString('es-UY')}. Buscá por nombre o email para encontrar
            al resto; el CSV trae a todos.
          </p>
        )}

        <p className="text-xs leading-relaxed text-bone/45">
          Por persona: el nombre y el email de su última entrada, su última fiesta y en cuántas tuvo entrada. No
          cuentan las anuladas ni las reembolsadas. Las bajas son las mismas de la preventa: el email en la whitelist
          como bloqueado.
        </p>
      </section>
    </div>
  );
}
