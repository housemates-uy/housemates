import { createAdminClient, fetchAll } from '@/lib/supabase/admin';

// Base de compradores para mailing (ADR #038): se arma leyendo las entradas, no se guarda en
// ningún lado (la whitelist no se toca, CLAUDE.md §7.1) y desde acá no se manda nada.
export type Buyer = {
  // Como lo escribió la persona en su última entrada (a esa dirección manda la preventa).
  email: string;
  emailNormalized: string;
  name: string;
  lastEvent: { title: string; date: string };
  events: number;
  // Mismo criterio que presale_audience: el email normalizado en la whitelist como 'banned'.
  unsubscribed: boolean;
};

// Entradas pagas o usadas de cualquier evento, cortesías incluidas, como presale_audience. Las
// anuladas (también compras abandonadas y transferencias rechazadas) y las reembolsadas no
// cuentan: esa persona no tuvo una entrada válida para esa fiesta.
export async function getBuyers(): Promise<Buyer[]> {
  const db = createAdminClient();
  const [tickets, banned] = await Promise.all([
    // De a páginas (PostgREST corta en 1000 filas), de la más vieja a la más nueva.
    fetchAll((from, to) =>
      db
        .from('tickets')
        .select('buyer_email, buyer_email_normalized, buyer_name, event_id, events(title, date_start)')
        .in('status', ['paid', 'used'])
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      db.from('whitelist').select('email').eq('status', 'banned').order('id').range(from, to),
    ),
  ]);
  const unsubscribed = new Set(banned.map((w) => w.email));

  type Acc = { email: string; name: string; events: Map<string, { title: string; date: string }> };
  const byEmail = new Map<string, Acc>();
  for (const t of tickets) {
    const event = t.events as unknown as { title: string; date_start: string };
    const acc = byEmail.get(t.buyer_email_normalized) ?? { email: '', name: '', events: new Map() };
    // Vienen ordenadas por fecha de carga: la última pisa a las anteriores.
    acc.email = t.buyer_email.trim();
    acc.name = t.buyer_name.trim();
    acc.events.set(t.event_id, { title: event.title, date: event.date_start });
    byEmail.set(t.buyer_email_normalized, acc);
  }

  return Array.from(byEmail, ([emailNormalized, a]) => ({
    email: a.email,
    emailNormalized,
    name: a.name,
    lastEvent: Array.from(a.events.values()).reduce((last, e) => (Date.parse(e.date) > Date.parse(last.date) ? e : last)),
    events: a.events.size,
    unsubscribed: unsubscribed.has(emailNormalized),
  })).sort(
    (a, b) =>
      Date.parse(b.lastEvent.date) - Date.parse(a.lastEvent.date) ||
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Cada palabra tiene que aparecer en el nombre o en el email, sin importar tildes ni mayúsculas.
export function matchesSearch(b: Buyer, q: string): boolean {
  const haystack = fold(`${b.name} ${b.email} ${b.emailNormalized}`);
  return fold(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
