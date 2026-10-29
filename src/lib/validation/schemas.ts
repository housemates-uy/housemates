import { z } from "zod";
import { isValidEmail } from "./email";
import { validateCI } from "./document";

export const emailSchema = z
  .string()
  .min(1, "Email requerido")
  .refine(isValidEmail, "Email inválido");

export const documentSchema = z
  .string()
  .min(1, "Cédula requerida")
  .refine(validateCI, "Cédula uruguaya inválida");

export const phoneSchema = z
  .string()
  .min(8, "Teléfono inválido")
  .regex(/^[\d\s\+\-\(\)]+$/, "Teléfono inválido");

export const buyerSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: emailSchema,
  phone: phoneSchema,
  document: documentSchema,
});

export const gateSchema = z.object({
  password: z.string().min(1, "Password requerido"),
});

export const whitelistBulkSchema = z.object({
  emails_raw: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(""),
});

export const checkoutSchema = z.object({
  event_id: z.string().uuid(),
  tier_id: z.string().uuid(),
  buyer: buyerSchema,
});

export const eventSchema = z.object({
  title: z.string().min(2, 'Título requerido'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  date_start: z.string().min(1, 'Fecha de inicio requerida'),
  date_end: z.string().min(1, 'Fecha de fin requerida'),
  location_name: z.string().min(2, 'Lugar requerido'),
  // Solo http(s): va tal cual al href de la landing, de Preguntas frecuentes y de los mails.
  location_url: z
    .string()
    .url('URL inválida')
    .refine((v) => /^https?:\/\//i.test(v), 'El link tiene que empezar con https://')
    .optional()
    .or(z.literal('')),
  format: z.string().trim().min(1, 'Formato requerido (ej. Open air)').max(30, 'Formato: máximo 30 caracteres'),
  capacity: z.coerce.number().int().positive('Capacidad debe ser mayor a 0'),
  status: z.enum(['draft', 'published', 'archived']),
  description_md: z.string().max(1000, 'Descripción: máximo 1000 caracteres').optional(),
}).refine((e) => !e.date_start || !e.date_end || e.date_end > e.date_start, {
  message: 'La fecha de fin tiene que ser posterior al inicio',
  path: ['date_end'],
})

export const PRESALE_CODE_RE = /^[A-Z0-9-]{3,30}$/

// Ingreso temprano ("HH:MM", hora de Montevideo), salida a la venta (datetime-local) y
// código de preventa (en mayúsculas). Vacío = no aplica. Ver docs/LOGICA_DE_NEGOCIO.md → "Tandas".
const tierExtras = {
  entry_until: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Hora de ingreso inválida (HH:MM)'),
  sales_start: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Fecha de salida a la venta inválida'),
  presale_code: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim().toUpperCase())
    .refine(
      (v) => v === '' || PRESALE_CODE_RE.test(v),
      'Código de preventa: de 3 a 30 letras sin tilde, números o guiones, sin espacios',
    ),
}

export const tierSchema = z.object({
  name: z.string().trim().min(1, 'Nombre de la tanda requerido'),
  price_uyu: z.coerce.number().positive('Precio debe ser mayor a 0'),
  quantity_total: z.coerce.number().int().positive('Cantidad debe ser mayor a 0'),
  description: z.string().optional(),
  ...tierExtras,
})

export const tiersSchema = z.array(tierSchema).min(1, 'Agregá al menos una tanda')

export const tierEditSchema = z.object({
  name: z.string().trim().min(1, 'Nombre de la tanda requerido'),
  price_uyu: z.coerce.number().positive('Precio debe ser mayor a 0'),
  quantity_total: z.coerce.number().int().positive('Cantidad debe ser mayor a 0'),
  description: z.string().optional(),
  active: z.boolean(),
  ...tierExtras,
})

export type EventInput = z.infer<typeof eventSchema>
export type TierInput = z.infer<typeof tierSchema>
export type TierEditInput = z.infer<typeof tierEditSchema>
export type Buyer = z.infer<typeof buyerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type WhitelistBulkInput = z.infer<typeof whitelistBulkSchema>;
