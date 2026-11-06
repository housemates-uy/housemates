import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Cliente con service_role — bypasea RLS. Solo usar en API routes de servidor.
// NUNCA exponer en código cliente ni en variables NEXT_PUBLIC_*.
// Todas las consultas van con `cache: 'no-store'`: Next 14 cachea los fetch del servidor
// por defecto, y sin esto la app mostraba datos viejos (p. ej. una entrada "válida" que ya
// se había usado en puerta). Esta base cambia en tiempo real: nunca se cachea.
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
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: 'no-store',
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : init?.signal,
          }),
      },
    }
  );
}

// PostgREST corta cada respuesta en 1000 filas (max_rows): sin paginar, una lista larga se
// pierde las últimas filas sin avisar. Trae de a páginas hasta la última. La consulta tiene
// que tener un orden estable (p. ej. created_at + id) para que las páginas no se pisen.
// Si una página falla, tira el error: mejor una pantalla de error que totales incompletos.
const PAGE_SIZE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
