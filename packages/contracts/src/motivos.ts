import { z } from 'zod'
import { idSchema, versionSchema } from './id.ts'
import { booleanQuerySchema } from './search.ts'

/**
 * Catálogo de motivos (`MotivoCatalogItem`, `motivo.types.ts`; ADR-010 §5). Es un catálogo de tamaño
 * fijo: no se pagina, tiene un tope documentado por empresa (ADR-BE-004, sub-decisión 6).
 */
export const MOTIVOS_MAX = 100

export const MOTIVO_TIPOS = ['rechazo', 'reprogramacion', 'no-entrega'] as const
export const motivoTipoSchema = z.enum(MOTIVO_TIPOS)
export type MotivoTipoContract = z.infer<typeof motivoTipoSchema>

/** Código del motivo: MAYÚSCULAS_CON_GUION_BAJO (`MERCADERIA_DANADA`, `OTRO`). Único por empresa y tipo. */
export const motivoCodigoSchema = z
  .string()
  .trim()
  .max(50)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'El código va en mayúsculas, con números y guiones bajos')

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
export type MotivoContract = z.infer<typeof motivoSchema>

const motivoFlagsShape = {
  descripcion: z.string().trim().min(1).max(200),
  requiereEvidencia: z.boolean(),
  disparaLogisticaInversa: z.boolean(),
}

/** POST /motivos. Nace activo. */
export const createMotivoRequestSchema = z.object({ codigo: motivoCodigoSchema, tipo: motivoTipoSchema, ...motivoFlagsShape }).strict()
export type CreateMotivoRequest = z.infer<typeof createMotivoRequestSchema>

/**
 * PUT /motivos/{id}: descripción y flags, con la versión leída. Código y tipo no se editan: las
 * entregas guardan el código (`motivoCodigo`), y cambiarlo cambiaría el sentido de las ya registradas.
 */
export const updateMotivoRequestSchema = z.object({ ...motivoFlagsShape, version: versionSchema }).strict()
export type UpdateMotivoRequest = z.infer<typeof updateMotivoRequestSchema>

/** GET /motivos: el catálogo completo de la empresa (hasta MOTIVOS_MAX), filtrable por tipo y estado. */
export const motivoCatalogQuerySchema = z.object({ tipo: motivoTipoSchema.optional(), activo: booleanQuerySchema.optional() }).strict()
export type MotivoCatalogQuery = z.infer<typeof motivoCatalogQuerySchema>

export const motivoCatalogSchema = z.object({ items: z.array(motivoSchema).max(MOTIVOS_MAX) }).strict()
export type MotivoCatalog = z.infer<typeof motivoCatalogSchema>

/** Códigos de error de motivos. */
export const motivoErrorCodes = {
  /** Ya hay un motivo con ese código y ese tipo en la empresa. */
  'motivo-duplicado': 422,
  /** La empresa ya tiene MOTIVOS_MAX motivos. */
  'motivos-limit-reached': 422,
} as const
export type MotivoErrorCode = keyof typeof motivoErrorCodes
