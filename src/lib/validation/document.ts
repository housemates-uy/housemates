// Valida cédula de identidad uruguaya con dígito verificador.
// Acepta formatos: "12345678", "1.234.567-8", "1234567-8"
export function validateCI(raw: string): boolean {
  const digits = raw.replace(/[\.\-\s]/g, "");
  if (!/^\d{7,8}$/.test(digits)) return false;

  const padded = digits.padStart(8, "0");
  const factors = [2, 9, 8, 7, 6, 3, 4];
  const body = padded.slice(0, 7);
  const checkDigit = parseInt(padded[7], 10);

  const sum = body
    .split("")
    .reduce((acc, d, i) => acc + parseInt(d, 10) * factors[i], 0);

  const remainder = sum % 10;
  const expected = remainder === 0 ? 0 : 10 - remainder;

  return checkDigit === expected;
}

// Formatea una CI al formato oficial: X.XXX.XXX-X
export function formatCI(raw: string): string {
  const digits = raw.replace(/[\.\-\s]/g, "").padStart(8, "0");
  const body = digits.slice(0, 7);
  const check = digits[7];
  return `${body[0]}.${body.slice(1, 4)}.${body.slice(4, 7)}-${check}`;
}
