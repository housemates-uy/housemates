// ============================================================
// Cargo por servicio de la compra web. Ver docs/LOGICA_DE_NEGOCIO.md → "Compra web".
// ============================================================
// Mercado Pago cobra 5,99 % + IVA (22 %) sobre el total cobrado, con la plata al instante:
// ≈ 7,31 %. El cargo se calcula para que, después de la comisión, quede al menos el precio
// de la entrada. Se redondea hacia arriba a múltiplos de $10 para que el total sea prolijo.
// Al comprador se le muestra el cargo en pesos, nunca el porcentaje.
// Si MP cambia la comisión (o se pasa a liberar a 21 días), se cambia solo esta constante.
export const MP_FEE_RATE = 0.0599 * 1.22;

export function priceBreakdown(ticketPrice: number) {
  const total = Math.ceil(ticketPrice / (1 - MP_FEE_RATE) / 10) * 10;
  return { price: ticketPrice, fee: total - ticketPrice, total };
}
