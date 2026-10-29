// ============================================================
// Cuentas de compradores. Ver docs/LOGICA_DE_NEGOCIO.md → "Cuentas de compradores".
// ============================================================
// Una cuenta = un usuario de Supabase Auth (el mismo Auth de los admins) + su perfil en
// `customers`. Ser comprador no da acceso al admin: eso pide una fila activa en `admins`
// (src/lib/auth/admin.ts).
//
// La cuenta se crea al comprar, con el email y la contraseña que escribió la persona, sin
// probar que el email es suyo. Por eso "Mis entradas" muestra:
//   - siempre, las entradas compradas desde la cuenta (`tickets.customer_id`);
//   - las demás a ese email (invitaciones, compras sin cuenta) recién cuando la persona
//     toca un link del mail ("Confirmá tu email" o el de recupero) y ahí elige la
//     contraseña. Al guardarla se cierran las otras sesiones y queda verificada: si la
//     cuenta la creó otro con este email, su contraseña deja de servir.
import { z } from 'zod';
import { formatLocal } from '@/lib/events';
import { sendMail } from '@/lib/mail/send';
import { accountConfirmEmail, passwordResetEmail } from '@/lib/mail/templates';
import { getIgHandle } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { appUrl, normalizeDocument } from '@/lib/tickets';
import { normalizeEmail } from '@/lib/validation/email';
import type { TicketStatus } from '@/types/database';

// Supabase corta en 72 caracteres.
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña tiene que tener al menos 8 caracteres.')
  .max(72, 'La contraseña puede tener hasta 72 caracteres.');

export type CustomerProfile = { name: string; document: string; phone: string | null };
export type CustomerSession = {
  id: string;
  email: string;
  // null si el usuario existe pero nunca compró con cuenta (p. ej. un admin).
  profile: CustomerProfile | null;
  verified: boolean;
};

// getUser() valida la sesión contra Supabase (getSession() solo lee la cookie).
export async function getCustomer(): Promise<CustomerSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await createAdminClient()
    .from('customers')
    .select('name, document, phone, email_verified_at')
    .eq('id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email,
    profile: data ? { name: data.name, document: data.document, phone: data.phone } : null,
    verified: !!data?.email_verified_at,
  };
}

async function findAuthUser(email: string) {
  const { data } = await createAdminClient().rpc('find_auth_user', { p_email: email });
  return data?.[0] ?? null;
}

export async function accountExists(email: string): Promise<boolean> {
  return !!(await findAuthUser(email));
}

// Supabase no deja pedir otro link al mismo usuario antes de un minuto; acá igual.
function sentLessThanAMinuteAgo(sentAt: string | null) {
  return !!sentAt && Date.now() - new Date(sentAt).getTime() < 60_000;
}

// Los links van a /auth/confirm, que gasta el token recién al tocar "Continuar" (así las
// vistas previas de los mails no lo usan) y después manda a elegir la contraseña.
function confirmUrl(tokenHash: string, type: 'magiclink' | 'recovery') {
  const q = new URLSearchParams({ token_hash: tokenHash, type, next: '/cuenta/nueva-clave' });
  return `${appUrl()}/auth/confirm?${q}`;
}

// Los mails de cuenta salen por el mismo SMTP que las entradas (src/lib/mail/send.ts), no
// por el de Supabase: el de Supabase solo le manda a los miembros del proyecto y de a poco.
export async function sendAccountConfirmMail(email: string, name: string): Promise<boolean> {
  const user = await findAuthUser(email);
  if (!user || sentLessThanAMinuteAgo(user.recovery_sent_at)) return false;
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) return false;
  const mail = accountConfirmEmail({
    firstName: name.split(' ')[0] || 'Hola',
    url: confirmUrl(data.properties.hashed_token, 'magiclink'),
    igHandle: await getIgHandle(),
  });
  return sendMail({ to: email, ...mail });
}

// Responde igual exista o no la cuenta: no revela qué emails están registrados.
export async function sendPasswordResetMail(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const user = await findAuthUser(email);
  if (!user || sentLessThanAMinuteAgo(user.recovery_sent_at)) return;
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data.properties?.hashed_token) return;
  const mail = passwordResetEmail({
    url: confirmUrl(data.properties.hashed_token, 'recovery'),
    igHandle: await getIgHandle(),
  });
  await sendMail({ to: email, ...mail });
}

// Sesión abierta con un link del mail ("Confirmá tu email" o recupero): Supabase lo deja
// firmado en el token (`amr`: otp); las de email + contraseña dicen password. Solo con esa
// sesión se elige contraseña en /cuenta/nueva-clave y se verifica el email.
const EMAIL_LINK_AMR = ['otp', 'magiclink', 'recovery'];

export async function openedFromEmailLink(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  const amr: (string | { method: string })[] = data?.claims.amr ?? [];
  return amr.some((a) => EMAIL_LINK_AMR.includes(typeof a === 'string' ? a : a.method));
}

// Devuelve true si la cuenta recién quedó verificada.
export async function markEmailVerified(userId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from('customers')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', userId)
    .is('email_verified_at', null)
    .select('id');
  return !!data?.length;
}

type BuyerData = { name: string; email: string; document: string; phone?: string | null };

// Se llama con la compra ya hecha (entrada creada y comprobante subido o pago iniciado):
// si algo falla acá la compra sigue igual, solo que sin cuenta. Devuelve el id de la cuenta.
export async function openAccount(buyer: BuyerData, password: string): Promise<string | null> {
  const db = createAdminClient();
  const email = buyer.email.trim().toLowerCase();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return null;

  const { error: profileError } = await db.from('customers').insert({
    id: data.user.id,
    name: buyer.name,
    document: normalizeDocument(buyer.document),
    phone: buyer.phone || null,
  });

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  await sendAccountConfirmMail(email, buyer.name);
  return profileError ? null : data.user.id;
}

// Compró con la sesión iniciada pero todavía no tenía perfil (p. ej. un admin): se guarda
// con los datos de esta compra.
export async function ensureProfile(customer: CustomerSession, buyer: BuyerData): Promise<string | null> {
  if (customer.profile) return customer.id;
  const { error } = await createAdminClient()
    .from('customers')
    .upsert(
      { id: customer.id, name: buyer.name, document: normalizeDocument(buyer.document), phone: buyer.phone || null },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  return error ? null : customer.id;
}

// ---------- Mis entradas ----------
export type AccountTicket = {
  id: string;
  eventTitle: string;
  dateShort: string;
  dateLabel: string;
  entryLabel: string;
  status: TicketStatus;
  statusLabel: string;
  href: string | null;
  upcoming: boolean;
  // Si en esa compra también sacó entradas para otros (§5.2e): para quiénes. Sin link a esas
  // entradas: a cada uno le llega la suya a su mail.
  boughtFor: { name: string; email: string }[];
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  paid: 'Válida',
  review: 'Transferencia a validar',
  used: 'Usada',
  pending: 'Pago pendiente',
  cancelled: 'Anulada',
  refunded: 'Anulada',
};

const TICKET_FIELDS =
  'id, order_id, status, qr_token, source, paid_at, payment_method, reserved_until, events(title, date_start, date_end), ticket_tiers(name)';

export async function loadAccountTickets(customer: CustomerSession): Promise<AccountTicket[]> {
  const db = createAdminClient();
  const [own, byEmail] = await Promise.all([
    db.from('tickets').select(TICKET_FIELDS).eq('customer_id', customer.id),
    customer.verified
      ? db.from('tickets').select(TICKET_FIELDS).eq('buyer_email_normalized', normalizeEmail(customer.email))
      : Promise.resolve({ data: [] }),
  ]);

  // De una compra de varias entradas, a quien compró le corresponde solo la suya (la que
  // apunta a sí misma): las de sus amigos son de ellos, aunque las haya pagado él.
  const ownLeads = (own.data ?? []).filter((t) => !t.order_id || t.order_id === t.id);
  const now = Date.now();
  const seen = new Set<string>();
  const rows = [...ownLeads, ...(byEmail.data ?? [])].filter((t) => {
    if (seen.has(t.id) || !t.events) return false;
    seen.add(t.id);
    // Fuera de la lista: reservas de Mercado Pago vencidas y compras con Mercado Pago que
    // nunca se pagaron (se anulan solas al reintentar). Para la persona no son entradas.
    if (t.status === 'pending') return !!t.reserved_until && new Date(t.reserved_until).getTime() > now;
    if (t.status === 'cancelled') return !(t.source === 'purchase' && t.payment_method !== 'transfer' && !t.paid_at);
    return true;
  });

  const startsAt = (t: (typeof rows)[number]) => new Date(t.events!.date_start).getTime();
  const isUpcoming = (t: (typeof rows)[number]) => new Date(t.events!.date_end).getTime() >= now;
  // Próximas primero (la más cercana arriba) y después las pasadas (la más reciente arriba).
  rows.sort((a, b) => {
    if (isUpcoming(a) !== isUpcoming(b)) return isUpcoming(a) ? -1 : 1;
    return isUpcoming(a) ? startsAt(a) - startsAt(b) : startsAt(b) - startsAt(a);
  });

  const leadIds = rows.filter((t) => t.order_id === t.id).map((t) => t.id);
  const { data: groupTickets } = leadIds.length
    ? await db.from('tickets').select('id, order_id, buyer_name, buyer_email').in('order_id', leadIds).order('buyer_name')
    : { data: [] };
  const boughtFor = new Map<string, { name: string; email: string }[]>();
  for (const g of groupTickets ?? []) {
    if (!g.order_id || g.id === g.order_id) continue;
    boughtFor.set(g.order_id, [...(boughtFor.get(g.order_id) ?? []), { name: g.buyer_name, email: g.buyer_email }]);
  }

  return rows.map((t) => ({
    id: t.id,
    eventTitle: t.events!.title,
    dateShort: formatLocal(t.events!.date_start, 'dd.MM.yy'),
    dateLabel: formatLocal(t.events!.date_start, "EEEE d 'de' MMMM · HH:mm 'hs'").replace(/^./, (c) => c.toUpperCase()),
    entryLabel: t.source === 'invitation' ? 'Cortesía' : (t.ticket_tiers?.name ?? 'Entrada'),
    status: t.status,
    statusLabel: STATUS_LABEL[t.status],
    href: t.qr_token ? `/ticket/${t.qr_token}` : null,
    upcoming: isUpcoming(t),
    boughtFor: boughtFor.get(t.id) ?? [],
  }));
}
