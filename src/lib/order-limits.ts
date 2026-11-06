// Tope de entradas por compra (§5.2e): lo elige un owner en /admin/config, de 1 a 10.
// Sin imports de servidor: lo usa también el formulario de configuración.
export const DEFAULT_MAX_PER_ORDER = 6;
export const MAX_PER_ORDER_LIMIT = 10;

export function parseMaxPerOrder(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PER_ORDER_LIMIT ? n : DEFAULT_MAX_PER_ORDER;
}
