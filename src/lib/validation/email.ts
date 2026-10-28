// Normaliza un email para almacenarlo y compararlo en la whitelist.
// Reglas: lowercase + para Gmail/Googlemail strip puntos y +tag.
export function normalizeEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const [localPart, domain] = trimmed.split("@");
  if (!localPart || !domain) return trimmed;

  const isGmail =
    domain === "gmail.com" || domain === "googlemail.com";

  if (isGmail) {
    const withoutTag = localPart.split("+")[0];
    const withoutDots = withoutTag.replace(/\./g, "");
    return `${withoutDots}@gmail.com`;
  }

  const withoutTag = localPart.split("+")[0];
  return `${withoutTag}@${domain}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
