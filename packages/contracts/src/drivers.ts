import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { booleanQuerySchema, searchQueryShape, searchResultSchema } from './search.ts'

/**
 * Licencia normalizada: mayúsculas, solo letras y números (BE-2, hallazgo M10). Es la forma que se
 * compara para la unicidad por empresa (`b-1234567`, `B 1234567` y `B1234567` son la misma licencia);
 * la licencia se guarda y se devuelve como la escribió el usuario.
 */
export function normalizeLicencia(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const licenciaSchema = z
  .string()
  .trim()
  .max(30)
  .refine(v => normalizeLicencia(v).length >= 3, 'La licencia tiene que tener al menos 3 letras o números')

/**
 * Chofer (`Driver`, `driver.types.ts`). Alcance EMPRESA, sin sucursal (ADR-BE-002). `usuarioId` es
 * el usuario de la app con el que se vincula, opcional y nulo desde el día uno (ADR-BE-003, decisión 5).
 */
export const driverSchema = z
  .object({
    id: idSchema,
    nombre: z.string(),
    licencia: z.string(),
    telefono: z.string(),
    activo: z.boolean(),
    usuarioId: idSchema.nullable(),
    version: versionSchema,
  })
  .strict()
export type DriverContract = z.infer<typeof driverSchema>

const driverFormShape = {
  nombre: z.string().trim().min(1).max(200),
  licencia: licenciaSchema,
  telefono: z.string().trim().min(1).max(50),
}

/** POST /drivers. Nace activo. `usuarioId` ausente es nulo. */
export const createDriverRequestSchema = z.object({ ...driverFormShape, usuarioId: idSchema.nullable().optional() }).strict()
export type CreateDriverRequest = z.infer<typeof createDriverRequestSchema>

/** PUT /drivers/{id}, con la versión leída. `usuarioId` ausente no cambia el vínculo; `null` lo quita. */
export const updateDriverRequestSchema = z
  .object({ ...driverFormShape, usuarioId: idSchema.nullable().optional(), version: versionSchema })
  .strict()
export type UpdateDriverRequest = z.infer<typeof updateDriverRequestSchema>

/** GET /drivers: lista blanca (la de `DriversPage`). */
export const driverListQuerySchema = offsetListQuerySchema({
  sortFields: ['nombre', 'licencia'],
  defaultSort: 'nombre',
  filters: { search: z.string().trim().max(100), activo: booleanQuerySchema },
})
export type DriverListQuery = z.infer<typeof driverListQuerySchema>

export const driverPageSchema = offsetPageSchema(driverSchema)
export type DriverPage = z.infer<typeof driverPageSchema>

/** GET /drivers/search: búsqueda acotada para selectores (por nombre o licencia). */
export const driverSearchQuerySchema = z.object({ ...searchQueryShape, activo: booleanQuerySchema.optional() }).strict()
export type DriverSearchQuery = z.infer<typeof driverSearchQuerySchema>

export const driverSearchResultSchema = searchResultSchema(driverSchema)
export type DriverSearchResult = z.infer<typeof driverSearchResultSchema>

/** Códigos de error de choferes. */
export const driverErrorCodes = {
  /** Otro chofer de la empresa ya tiene esa licencia (comparada normalizada). */
  'licencia-duplicada': 422,
  /** `usuarioId` no es un usuario de la empresa. */
  'user-not-found': 422,
  /** El usuario ya está vinculado a otro chofer. */
  'user-already-linked': 422,
} as const
export type DriverErrorCode = keyof typeof driverErrorCodes
