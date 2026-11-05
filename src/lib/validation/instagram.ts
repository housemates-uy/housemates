// Usuario de Instagram de cada persona en la compra web (obligatorio, §5.2e). Se acepta
// "@usuario", "usuario" o el link del perfil, y se guarda como siempre en
// `tickets.buyer_instagram`: sin @ y en minúsculas. Se muestra como @usuario. Sin imports de
// servidor: lo usa también el formulario de compra en el navegador.
export const INSTAGRAM_USERNAME_RE = /^[a-z0-9._]{1,30}$/;

export const INSTAGRAM_MISSING = 'Falta el usuario de Instagram.';
export const INSTAGRAM_INVALID = 'Usuario de Instagram inválido: solo letras, números, puntos y guiones bajos (hasta 30).';

export function instagramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

// null si está bien; si no, el motivo.
export function instagramError(raw: string): string | null {
  const username = instagramUsername(raw);
  if (!username) return INSTAGRAM_MISSING;
  return INSTAGRAM_USERNAME_RE.test(username) ? null : INSTAGRAM_INVALID;
}
