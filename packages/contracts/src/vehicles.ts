import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { booleanQuerySchema, searchQueryShape, searchResultSchema } from './search.ts'

/**
 * Patente normalizada: mayúsculas, sin espacios ni guiones (BE-2). Se guarda así y es la forma que
 * se compara para la unicidad por empresa (`ab 123-cd` y `AB123CD` son la misma patente).
 */
export function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '')
}

export const patenteSchema = z
  .string()
  .trim()
  .max(20)
  .transform(normalizePatente)
  .pipe(z.string().regex(/^[A-Z0-9]{5,10}$/, 'La patente tiene que tener entre 5 y 10 letras o números'))

/** Capacidad del vehículo (`VehicleCapacity`, `vehicle.types.ts`). */
export const vehicleCapacitySchema = z
  .object({
    bultos: z.int().min(0).max(1_000_000),
    pesoKg: z.number().min(0).max(1_000_000),
    volumenM3: z.number().min(0).max(10_000),
    refrigerado: z.boolean(),
    zonasHabilitadas: z.array(z.string().trim().min(1).max(50)).min(1).max(20),
  })
  .strict()
export type VehicleCapacityContract = z.infer<typeof vehicleCapacitySchema>

/** Vehículo (`Vehicle`, `vehicle.types.ts`). Alcance EMPRESA, sin sucursal (ADR-BE-002). */
export const vehicleSchema = z
  .object({
    id: idSchema,
    patente: z.string(),
    tipo: z.string(),
    capacidad: vehicleCapacitySchema,
    activo: z.boolean(),
    version: versionSchema,
  })
  .strict()
export type VehicleContract = z.infer<typeof vehicleSchema>

const vehicleFormShape = {
  patente: patenteSchema,
  tipo: z.string().trim().min(1).max(100),
  capacidad: vehicleCapacitySchema,
}

/** POST /vehicles. Nace activo. */
export const createVehicleRequestSchema = z.object(vehicleFormShape).strict()
export type CreateVehicleRequest = z.infer<typeof createVehicleRequestSchema>

/** PUT /vehicles/{id}, con la versión leída. El estado se cambia con activate/deactivate. */
export const updateVehicleRequestSchema = z.object({ ...vehicleFormShape, version: versionSchema }).strict()
export type UpdateVehicleRequest = z.infer<typeof updateVehicleRequestSchema>

/** GET /vehicles: lista blanca (la de `VehiclesPage`). */
export const vehicleListQuerySchema = offsetListQuerySchema({
  sortFields: ['patente', 'tipo'],
  defaultSort: 'patente',
  filters: { search: z.string().trim().max(100), activo: booleanQuerySchema },
})
export type VehicleListQuery = z.infer<typeof vehicleListQuerySchema>

export const vehiclePageSchema = offsetPageSchema(vehicleSchema)
export type VehiclePage = z.infer<typeof vehiclePageSchema>

/** GET /vehicles/search: búsqueda acotada para selectores (por patente o tipo). */
export const vehicleSearchQuerySchema = z.object({ ...searchQueryShape, activo: booleanQuerySchema.optional() }).strict()
export type VehicleSearchQuery = z.infer<typeof vehicleSearchQuerySchema>

export const vehicleSearchResultSchema = searchResultSchema(vehicleSchema)
export type VehicleSearchResult = z.infer<typeof vehicleSearchResultSchema>

/** Códigos de error de vehículos. */
export const vehicleErrorCodes = {
  /** Otro vehículo de la empresa ya tiene esa patente (comparada normalizada). */
  'patente-duplicada': 422,
} as const
export type VehicleErrorCode = keyof typeof vehicleErrorCodes
