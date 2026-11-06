// ============================================================
// Límite de intentos por IP. Ver docs/LOGICA_DE_NEGOCIO.md → §8c.
// ============================================================
// El conteo es atómico en Postgres (rate_limit_hit, migración 0016). Si la base falla, se
// deja pasar (un límite caído no puede frenar una compra), salvo en FAIL_CLOSED: ahí probar
// códigos sin límite es justo lo que se quiere frenar, y sin base tampoco se podría entrar.
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

// Mucha gente comparte IP (celulares detrás de la misma IP de la compañía, el wifi de la
// fiesta), así que los topes son por "conexión", no por persona: tienen que dejar pasar un
// lanzamiento de entradas y frenar solo a un script.
// - checkout: cuenta ENTRADAS, no compras (una compra de 4 suma 4): cada intento puede
//   reservar lugares con un comprobante falso. 60 por IP cada 10 minutos.
// - bar_checkout: un pedido sin pagar no reserva nada ni manda mails, y en la fiesta todos
//   comparten el wifi: tope alto.
const LIMITS = {
  checkout: { windowSeconds: 10 * 60, max: 60 },
  discount: { windowSeconds: 10 * 60, max: 30 },
  bar_checkout: { windowSeconds: 10 * 60, max: 120 },
  // Códigos de acceso (§3b). Cuenta solo los intentos FALLIDOS (isBlocked + allowAttempt al
  // fallar): con datos móviles miles de personas comparten IP y, cuando sale una historia,
  // muchas ponen el código bien a la vez. Probar códigos al azar sí suma. Los generados (8
  // caracteres al azar) no se adivinan; uno propio corto sí podría: el límite no se saltea.
  access_code: { windowSeconds: 15 * 60, max: 20 },
  // Login de compradores y de admins: Supabase ve la IP de Vercel, no la de quien prueba.
  login: { windowSeconds: 15 * 60, max: 10 },
  // Recupero y reenvío de confirmación: cada uno manda un mail (Gmail corta en ~500 por día).
  reset: { windowSeconds: 15 * 60, max: 5 },
  // /compra/resultado consulta a Mercado Pago con nuestro token en cada visita.
  result: { windowSeconds: 10 * 60, max: 60 },
};

export type RateLimitAction = keyof typeof LIMITS;

const FAIL_CLOSED = new Set<RateLimitAction>(['access_code']);

export const TOO_MANY_ATTEMPTS =
  'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';

// En Vercel, x-forwarded-for lo pone la plataforma (no se puede falsear desde el navegador).
function clientIp(): string {
  const h = headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown';
}

const LOOPBACK = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

// Solo mira si la IP ya llegó al tope, sin sumar un intento. Para los límites que cuentan
// fallos: se mira antes y se suma con allowAttempt recién si el intento falla.
export async function isBlocked(action: RateLimitAction): Promise<boolean> {
  const { windowSeconds, max } = LIMITS[action];
  try {
    const ip = clientIp();
    if (process.env.NODE_ENV !== 'production' && LOOPBACK.has(ip)) return false;
    const { data, error } = await createAdminClient().rpc('rate_limit_blocked', {
      p_key: ip,
      p_action: action,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw new Error(error.message);
    return data === true;
  } catch (err) {
    console.error('[rate-limit] no se pudo leer el límite', action, (err as Error)?.message);
    return FAIL_CLOSED.has(action);
  }
}

// true = puede seguir. weight: cuántos intentos suma (en la compra, una por entrada).
export async function allowAttempt(action: RateLimitAction, weight = 1): Promise<boolean> {
  const { windowSeconds, max } = LIMITS[action];
  try {
    const ip = clientIp();
    // `npm run dev` en la propia máquina: los scripts de prueba compran muchas veces seguidas.
    // Para probar el límite en local, mandar otro x-forwarded-for.
    if (process.env.NODE_ENV !== 'production' && LOOPBACK.has(ip)) return true;
    const db = createAdminClient();
    for (let i = 0; i < weight; i++) {
      const { data, error } = await db.rpc('rate_limit_hit', {
        p_key: ip,
        p_action: action,
        p_window_seconds: windowSeconds,
        p_max: max,
      });
      if (error) throw new Error(error.message);
      if (data === true) return false;
    }
    return true;
  } catch (err) {
    console.error('[rate-limit] no se pudo contar el intento', action, (err as Error)?.message);
    return !FAIL_CLOSED.has(action);
  }
}
