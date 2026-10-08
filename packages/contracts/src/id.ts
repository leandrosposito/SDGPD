import { z } from 'zod'

/**
 * Id de cualquier recurso: UUID, generado por el servidor (v7, ADR-BE-004 › Ids).
 * El contrato acepta cualquier UUID RFC 9562; que sea v7 es responsabilidad de quien lo genera.
 */
export const idSchema = z.uuid()
export type Id = z.infer<typeof idSchema>

/** Versión de un agregado editable (ADR-BE-005 › Concurrencia): entero desde 1, obligatoria al actualizar. */
export const versionSchema = z.int().min(1)
export type Version = z.infer<typeof versionSchema>
