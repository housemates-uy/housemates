// Sin imports de Node: este módulo también lo usa el middleware (edge runtime).
export const GATE_COOKIE = 'hm_access';
export const GATE_TTL_SECONDS = 60 * 60 * 24;

export type GateSession = {
  granted?: true;
  grantedAt?: number;
  version?: string;
};
