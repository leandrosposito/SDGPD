import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { SEARCH_MAX_LENGTH } from './suppliers.ts'
import { instantSchema } from './time.ts'

/**
 * Chofer: alcance EMPRESA. Entidad propia, sin usuario obligatorio (ADR-BE-003, sub-decisión 5: el
 * vínculo con `users` existe en la base, nulo desde el día uno, y todavía no viaja en el contrato).
 */
export const driverSchema = z
  .object({
    id: idSchema,
    nombre: z.string(),
    licencia: z.string(),
    telefono: z.string(),
    activo: z.boolean(),
    version: versionSchema,
    createdAt: instantSchema,
  })
  .strict()
export type Driver = z.infer<typeof driverSchema>

export const createDriverRequestSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200),
    licencia: z.string().trim().min(1).max(50),
    telefono: z.string().trim().max(50).default(''),
  })
  .strict()
export type CreateDriverRequest = z.infer<typeof createDriverRequestSchema>

export const updateDriverRequestSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200),
    licencia: z.string().trim().min(1).max(50),
    telefono: z.string().trim().max(50),
    version: versionSchema,
  })
  .strict()
export type UpdateDriverRequest = z.infer<typeof updateDriverRequestSchema>

export const driverListQuerySchema = offsetListQuerySchema({
  sortFields: ['nombre', 'licencia'],
  defaultSort: 'nombre',
  filters: {
    search: z.string().trim().min(1).max(SEARCH_MAX_LENGTH),
    soloActivos: z.enum(['true', 'false']).transform(v => v === 'true'),
  },
})
export type DriverListQuery = z.infer<typeof driverListQuerySchema>

export const driverPageSchema = offsetPageSchema(driverSchema)
export type DriverPage = z.infer<typeof driverPageSchema>
