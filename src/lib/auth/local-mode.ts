// Modo local sin claves: saltea la contraseña de /entradas y el login del admin.
// Es solo para la máquina de quien desarrolla. Se prende solo si se cumplen todas:
//   - corre con `npm run dev` (NODE_ENV=development; `next build` lo fija en 'production')
//   - LOCAL_SIN_CLAVES=1 en .env.local
//   - no corre en Vercel (Vercel define VERCEL=1, también en los previews)
//   - la base es la de Docker (127.0.0.1 o localhost): nunca contra datos reales
// `npm run dev` escucha solo en 127.0.0.1, así nadie de la misma red entra al admin.
// Sin imports de Node: este módulo también lo usa el middleware (edge runtime).
const LOCAL_DB = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

export function isLocalNoAuth(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.LOCAL_SIN_CLAVES === '1' &&
    !process.env.VERCEL &&
    LOCAL_DB.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  );
}
