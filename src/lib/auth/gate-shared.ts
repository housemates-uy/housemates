// Sin imports de Node: este módulo también lo usa el middleware (edge runtime).
export const GATE_COOKIE = 'hm_access';
// El acceso con un código dura 1 hora desde que se puso (decisión de los owners, 2026-11-06):
// no se renueva al navegar. Pasada la hora, o apenas se compra, hay que volver a ponerlo.
export const GATE_TTL_SECONDS = 60 * 60;

export type GateSession = {
  // Código de acceso con el que entró (§3b): lo usa la compra, no lo manda el formulario.
  accessCodeId?: string;
  grantedAt?: number;
};
