import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { booleanQuerySchema, searchQueryShape, searchResultSchema } from './search.ts'

/**
 * CUIT normalizado: sin espacios ni guiones (BE-2). Es la forma que se compara para la unicidad por
 * empresa; el CUIT se guarda y se devuelve como lo escribió el usuario.
 */
export function normalizeCuit(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

/** CUIT: 11 dígitos, admite espacios y guiones como separadores (`30-54321678-9`). */
export const cuitSchema = z
  .string()
  .trim()
  .max(20)
  .refine(v => /^\d{11}$/.test(normalizeCuit(v)), 'El CUIT tiene que tener 11 dígitos')

/** Email de contacto: vacío o un email válido. */
const contactEmailSchema = z.string().trim().pipe(z.union([z.literal(''), z.email().max(254)]))
const optionalText = (max: number) => z.string().trim().max(max).default('')

/**
 * Proveedor (`Supplier` del frontend, `supplier.types.ts`), sin los campos de la cuenta del proveedor
 * (`pendingOrdersCount`, `daysUntilExpiration`, `currentBalance`, `hasOverdueDebt`) ni sus productos:
 * no son atributos del maestro, los calcula compras y pagos (BE-8 en adelante). `active` es nuevo
 * (BE-2); va en inglés como el resto de los campos de la entidad (ADR-BE-004 › DTO, regla 1).
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
    active: z.boolean(),
    version: versionSchema,
  })
  .strict()
export type SupplierContract = z.infer<typeof supplierSchema>

/** Los campos que edita el formulario de proveedores. */
const supplierFormShape = {
  name: z.string().trim().min(1).max(200),
  cuit: cuitSchema,
  category: z.string().trim().min(1).max(100),
  phone: optionalText(50),
  contactEmail: contactEmailSchema,
}

/** POST /suppliers. Los datos de contacto, dirección y condiciones de pago son opcionales. */
export const createSupplierRequestSchema = z
  .object({
    ...supplierFormShape,
    contactName: optionalText(200),
    address: optionalText(200),
    city: optionalText(100),
    paymentTerms: optionalText(100),
  })
  .strict()
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>

/** PUT /suppliers/{id}: los campos del formulario, con la versión leída. El resto no cambia. */
export const updateSupplierRequestSchema = z.object({ ...supplierFormShape, version: versionSchema }).strict()
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>

/** GET /suppliers: lista blanca (la que usa `SuppliersPage`, sin `currentBalance`: no es del maestro). */
export const supplierListQuerySchema = offsetListQuerySchema({
  sortFields: ['name', 'cuit', 'category'],
  defaultSort: 'name',
  filters: {
    search: z.string().trim().max(100),
    category: z.string().trim().max(100),
    active: booleanQuerySchema,
  },
})
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>

export const supplierPageSchema = offsetPageSchema(supplierSchema)
export type SupplierPage = z.infer<typeof supplierPageSchema>

/** GET /suppliers/search: búsqueda acotada para selectores (por razón social o CUIT). */
export const supplierSearchQuerySchema = z.object({ ...searchQueryShape, active: booleanQuerySchema.optional() }).strict()
export type SupplierSearchQuery = z.infer<typeof supplierSearchQuerySchema>

export const supplierSearchResultSchema = searchResultSchema(supplierSchema)
export type SupplierSearchResult = z.infer<typeof supplierSearchResultSchema>

/** Códigos de error de proveedores. */
export const supplierErrorCodes = {
  /** Otro proveedor de la empresa ya tiene ese CUIT (comparado normalizado). */
  'cuit-duplicado': 422,
} as const
export type SupplierErrorCode = keyof typeof supplierErrorCodes
