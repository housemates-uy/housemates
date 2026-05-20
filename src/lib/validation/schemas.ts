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
  location_url: z.string().url('URL inválida').optional().or(z.literal('')),
  capacity: z.coerce.number().int().positive('Capacidad debe ser mayor a 0'),
  status: z.enum(['draft', 'published', 'archived']),
  description_md: z.string().optional(),
})

export const tierSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  price_uyu: z.coerce.number().positive('Precio debe ser mayor a 0'),
  quantity_total: z.coerce.number().int().positive('Cantidad debe ser mayor a 0'),
  description: z.string().optional(),
})

export const tiersSchema = z.array(tierSchema).min(1, 'Agregá al menos un tier')

export const tierEditSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  price_uyu: z.coerce.number().positive('Precio debe ser mayor a 0'),
  quantity_total: z.coerce.number().int().positive('Cantidad debe ser mayor a 0'),
  description: z.string().optional(),
  active: z.boolean(),
})

export type EventInput = z.infer<typeof eventSchema>
export type TierInput = z.infer<typeof tierSchema>
export type TierEditInput = z.infer<typeof tierEditSchema>
export type Buyer = z.infer<typeof buyerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type WhitelistBulkInput = z.infer<typeof whitelistBulkSchema>;
