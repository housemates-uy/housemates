// Modo local sin claves: saltea la contraseña de /entradas y el login del admin.
// Es solo para la máquina de quien desarrolla. Se prende solo si se cumplen las tres cosas:
//   - corre con `npm run dev` (NODE_ENV=development; `next build` lo fija en 'production')
//   - LOCAL_SIN_CLAVES=1 en .env.local
//   - no corre en Vercel (Vercel define VERCEL=1, también en los previews)
// Sin imports de Node: este módulo también lo usa el middleware (edge runtime).
export function isLocalNoAuth(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.LOCAL_SIN_CLAVES === '1' &&
    !process.env.VERCEL
  );
}
