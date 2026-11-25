import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { instantSchema } from './time.ts'

/** Tope del texto de búsqueda de un listado (ADR-016: búsqueda acotada). */
export const SEARCH_MAX_LENGTH = 100

/** CUIT: 11 dígitos, con o sin guiones (`30-71234567-8`). Se guarda como se escribió. */
const cuitSchema = z
  .string()
  .trim()
  .regex(/^\d{2}-?\d{8}-?\d$/, 'CUIT inválido')

const textSchema = z.string().trim().max(200)
const emailOrEmptySchema = z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email().max(254))])

/**
 * Proveedor (`Supplier` del frontend, sin `empresaId`: ADR-BE-002, sub-decisión 5). Solo el maestro:
 * el saldo, las órdenes pendientes y los productos los aportan Compras y Cuenta corriente (BE-8, BE-9).
 */
export const supplierSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    cuit: z.string(),
    phone: z.string(),
    contactName: z.string(),
    contactEmail: z.string(),
    address: z.string(),
    city: z.string(),
    paymentTerms: z.string(),
    category: z.string(),
    version: versionSchema,
    createdAt: instantSchema,
  })
  .strict()
export type Supplier = z.infer<typeof supplierSchema>

/** POST /suppliers: razón social y CUIT obligatorios, el resto vacío por defecto. */
export const createSupplierRequestSchema = z
  .object({
    name: textSchema.min(1),
    cuit: cuitSchema,
    phone: textSchema.default(''),
    contactName: textSchema.default(''),
    contactEmail: emailOrEmptySchema.default(''),
    address: textSchema.default(''),
    city: textSchema.default(''),
    paymentTerms: textSchema.default(''),
    category: textSchema.default(''),
  })
  .strict()
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>

/** PUT /suppliers/{id}: los campos que no vienen no cambian. Lleva la versión leída. */
export const updateSupplierRequestSchema = z
  .object({
    name: textSchema.min(1),
    cuit: cuitSchema,
    phone: textSchema,
    contactName: textSchema,
    contactEmail: emailOrEmptySchema,
    address: textSchema,
    city: textSchema,
    paymentTerms: textSchema,
    category: textSchema,
  })
  .partial()
  .extend({ version: versionSchema })
  .strict()
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>

/** GET /suppliers: lista blanca. `search` busca en razón social y CUIT. */
export const supplierListQuerySchema = offsetListQuerySchema({
  sortFields: ['name', 'cuit', 'category'],
  defaultSort: 'name',
  filters: { search: z.string().trim().min(1).max(SEARCH_MAX_LENGTH), category: z.string().min(1).max(200) },
})
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>

export const supplierPageSchema = offsetPageSchema(supplierSchema)
export type SupplierPage = z.infer<typeof supplierPageSchema>

export const supplierErrorCodes = {
  /** Otro proveedor de la empresa tiene el mismo CUIT (se compara sin guiones). */
  'cuit-duplicado': 422,
} as const
export type SupplierErrorCode = keyof typeof supplierErrorCodes
