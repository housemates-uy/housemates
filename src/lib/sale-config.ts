// ============================================================
// Configuración de la venta (tabla site_config, se cambia desde /admin/config).
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { isMercadoPagoConfigured } from '@/lib/mercadopago';

export type SaleConfig = {
  gateEnabled: boolean; // pedir la contraseña para comprar
  mpEnabled: boolean; // Mercado Pago prendido en el admin: se muestra como opción
  mpReady: boolean; // Mercado Pago conectado (MP_ACCESS_TOKEN): recién ahí cobra
  transferEnabled: boolean; // transferencia activa (y con datos de cuenta cargados)
  transferDetails: string; // datos para transferir, texto libre
};

const KEYS = ['gate_enabled', 'pay_mp_enabled', 'pay_transfer_enabled', 'transfer_details'] as const;

export async function getSaleConfig(): Promise<SaleConfig> {
  const map = new Map<string, string>();
  try {
    const { data } = await createAdminClient().from('site_config').select('key, value').in('key', [...KEYS]);
    (data ?? []).forEach((r) => map.set(r.key, r.value));
  } catch {
    // Sin base: se toman los valores por defecto.
  }
  const transferDetails = (map.get('transfer_details') ?? '').trim();
  return {
    gateEnabled: map.get('gate_enabled') !== '0',
    mpEnabled: map.get('pay_mp_enabled') !== '0',
    mpReady: isMercadoPagoConfigured(),
    // Sin datos de cuenta no tiene sentido ofrecer transferencia.
    transferEnabled: map.get('pay_transfer_enabled') !== '0' && transferDetails.length > 0,
    transferDetails,
  };
}
