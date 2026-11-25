import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'

/** Tipos de evento con catálogo propio (`MotivoTipo` del frontend). */
export const MOTIVO_TIPOS = ['rechazo', 'reprogramacion', 'no-entrega'] as const
export const motivoTipoSchema = z.enum(MOTIVO_TIPOS)
export type MotivoTipo = z.infer<typeof motivoTipoSchema>

/** Catálogo de tamaño fijo, sin paginación (ADR-BE-004, sub-decisión 6). */
export const MAX_MOTIVOS = 200

/** Motivo del catálogo de la empresa. `codigo` y `tipo` no cambian una vez creado. */
export const motivoSchema = z
  .object({
    id: idSchema,
    codigo: z.string(),
    tipo: motivoTipoSchema,
    descripcion: z.string(),
    activo: z.boolean(),
    requiereEvidencia: z.boolean(),
    disparaLogisticaInversa: z.boolean(),
    version: versionSchema,
  })
  .strict()
export type Motivo = z.infer<typeof motivoSchema>

export const motivoListSchema = z.object({ items: z.array(motivoSchema).max(MAX_MOTIVOS) }).strict()
export type MotivoList = z.infer<typeof motivoListSchema>

/** GET /motivos: `tipo` filtra; `soloActivos` (por defecto `true`) es lo que muestran los selectores. */
export const motivoListQuerySchema = z
  .object({
    tipo: motivoTipoSchema.optional(),
    soloActivos: z
      .enum(['true', 'false'])
      .transform(v => v === 'true')
      .default(true),
  })
  .strict()
export type MotivoListQuery = z.infer<typeof motivoListQuerySchema>

/** PUT /motivos/{id}: lo editable (no `codigo` ni `tipo`), con la versión leída. */
export const updateMotivoRequestSchema = z
  .object({
    descripcion: z.string().trim().min(1).max(200),
    activo: z.boolean(),
    requiereEvidencia: z.boolean(),
    disparaLogisticaInversa: z.boolean(),
    version: versionSchema,
  })
  .strict()
export type UpdateMotivoRequest = z.infer<typeof updateMotivoRequestSchema>
