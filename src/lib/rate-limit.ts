// ============================================================
// Límite de intentos por IP. Ver docs/LOGICA_DE_NEGOCIO.md → §8c.
// ============================================================
// El conteo es atómico en Postgres (rate_limit_hit, migración 0016). Si la base falla, se
// deja pasar: un límite caído no puede frenar una compra.
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

// Mucha gente comparte IP (celulares detrás de la misma IP de la compañía, el wifi de la
// fiesta), así que los topes son por "conexión", no por persona: tienen que dejar pasar un
// lanzamiento de entradas y frenar solo a un script.
// - checkout: cada intento puede reservar un lugar con un comprobante falso.
// - bar_checkout: un pedido sin pagar no reserva nada ni manda mails, y en la fiesta todos
//   comparten el wifi: tope alto.
const LIMITS = {
  checkout: { windowSeconds: 10 * 60, max: 30 },
  discount: { windowSeconds: 10 * 60, max: 30 },
  bar_checkout: { windowSeconds: 10 * 60, max: 120 },
  gate: { windowSeconds: 15 * 60, max: 5 }, // fijado en .claude/CLAUDE.md §7.2
};

export type RateLimitAction = keyof typeof LIMITS;

export const TOO_MANY_ATTEMPTS = 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';

// En Vercel, x-forwarded-for lo pone la plataforma (no se puede falsear desde el navegador).
function clientIp(): string {
  const h = headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown';
}

const LOOPBACK = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

// true = puede seguir.
export async function allowAttempt(action: RateLimitAction): Promise<boolean> {
  const { windowSeconds, max } = LIMITS[action];
  try {
    const ip = clientIp();
    // `npm run dev` en la propia máquina: los scripts de prueba compran muchas veces seguidas.
    // Para probar el límite en local, mandar otro x-forwarded-for.
    if (process.env.NODE_ENV !== 'production' && LOOPBACK.has(ip)) return true;
    const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
      p_key: ip,
      p_action: action,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw new Error(error.message);
    return data !== true;
  } catch (err) {
    console.error('[rate-limit] no se pudo contar el intento', action, (err as Error)?.message);
    return true;
  }
}
