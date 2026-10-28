// ============================================================
// Precio de la compra web. Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web".
// ============================================================
// Con Mercado Pago se suma un cargo por servicio del 7,5 % (la comisión de la plataforma),
// calculado sobre el precio ya descontado y redondeado al peso. Con transferencia no hay
// cargo. Al comprador se le muestra el cargo en pesos.
// Si cambia la comisión, se cambia solo esta constante.
export const SERVICE_FEE_RATE = 0.075;

export type PayMethod = 'mercadopago' | 'transfer';

export function priceBreakdown(ticketPrice: number) {
  const fee = Math.round(ticketPrice * SERVICE_FEE_RATE);
  return { price: ticketPrice, fee, total: ticketPrice + fee };
}

// Descuento de un código, en pesos enteros. Nunca más que el precio de la entrada.
export function discountAmount(price: number, code: { kind: string; value: number } | null): number {
  if (!code) return 0;
  const raw = code.kind === 'percent' ? Math.round((price * code.value) / 100) : Math.round(code.value);
  return Math.min(Math.max(raw, 0), price);
}

// Lo que paga la persona según el medio de pago:
//   Mercado Pago → (precio − descuento) + transporte + 7,5 % de cargo sobre todo eso
//   Transferencia → (precio − descuento) + transporte, sin cargo.
// `subtotal` es solo la entrada ya descontada: el código de descuento no toca el transporte.
export function quote(price: number, discount: number, method: PayMethod, transport = 0) {
  const subtotal = Math.max(price - discount, 0);
  if (method === 'transfer') return { price, discount, subtotal, transport, fee: 0, total: subtotal + transport };
  const { fee, total } = priceBreakdown(subtotal + transport);
  return { price, discount, subtotal, transport, fee, total };
}
