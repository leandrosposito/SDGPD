import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { SEARCH_MAX_LENGTH } from './suppliers.ts'
import { instantSchema } from './time.ts'

/** Patente canónica: mayúsculas y sin espacios (un identificador, no un texto libre). */
export function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '')
}

const patenteSchema = z
  .string()
  .transform(normalizePatente)
  .pipe(z.string().min(5).max(10).regex(/^[A-Z0-9]+$/, 'patente inválida'))

/** Capacidad de carga de un vehículo (`VehicleCapacity` del frontend). */
export const vehicleCapacitySchema = z
  .object({
    bultos: z.int().nonnegative(),
    pesoKg: z.number().nonnegative().finite(),
    volumenM3: z.number().nonnegative().finite(),
    refrigerado: z.boolean(),
    zonasHabilitadas: z.array(z.string().trim().min(1).max(50)).max(50),
  })
  .strict()
export type VehicleCapacity = z.infer<typeof vehicleCapacitySchema>

/** Vehículo de la flota: alcance EMPRESA. Sin `empresaId` en el wire. */
export const vehicleSchema = z
  .object({
    id: idSchema,
    patente: z.string(),
    tipo: z.string(),
    capacidad: vehicleCapacitySchema,
    activo: z.boolean(),
    version: versionSchema,
    createdAt: instantSchema,
  })
  .strict()
export type Vehicle = z.infer<typeof vehicleSchema>

/** POST /vehicles (nace activo) y PUT /vehicles/{id} (con la versión leída). */
export const createVehicleRequestSchema = z
  .object({ patente: patenteSchema, tipo: z.string().trim().min(1).max(100), capacidad: vehicleCapacitySchema })
  .strict()
export type CreateVehicleRequest = z.infer<typeof createVehicleRequestSchema>

export const updateVehicleRequestSchema = createVehicleRequestSchema.extend({ version: versionSchema }).strict()
export type UpdateVehicleRequest = z.infer<typeof updateVehicleRequestSchema>

/** POST /vehicles/{id}/activate y /deactivate (y los de choferes): solo la versión leída. */
export const versionRequestSchema = z.object({ version: versionSchema }).strict()
export type VersionRequest = z.infer<typeof versionRequestSchema>

/** GET /vehicles: lista blanca. `soloActivos` alimenta los selectores (ADR-016). */
export const vehicleListQuerySchema = offsetListQuerySchema({
  sortFields: ['patente', 'tipo'],
  defaultSort: 'patente',
  filters: {
    search: z.string().trim().min(1).max(SEARCH_MAX_LENGTH),
    soloActivos: z.enum(['true', 'false']).transform(v => v === 'true'),
  },
})
export type VehicleListQuery = z.infer<typeof vehicleListQuerySchema>

export const vehiclePageSchema = offsetPageSchema(vehicleSchema)
export type VehiclePage = z.infer<typeof vehiclePageSchema>

export const vehicleErrorCodes = {
  /** Otro vehículo de la empresa tiene la misma patente normalizada. */
  'patente-duplicada': 422,
} as const
export type VehicleErrorCode = keyof typeof vehicleErrorCodes
