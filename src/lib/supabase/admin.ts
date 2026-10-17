import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Cliente con service_role — bypasea RLS. Solo usar en API routes de servidor.
// NUNCA exponer en código cliente ni en variables NEXT_PUBLIC_*.
// `timeoutMs` corta lecturas no críticas (landing) para que una base lenta no
// trabe el render: esas lecturas tienen fallback (y van con `.retry(false)`).
export function createAdminClient({ timeoutMs }: { timeoutMs?: number } = {}) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: timeoutMs
        ? { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }) }
        : undefined,
    }
  );
}
