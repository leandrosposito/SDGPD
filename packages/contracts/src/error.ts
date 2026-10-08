import { z } from 'zod'

/** `code`: vocabulario único en kebab-case (ADR-BE-004 › Errores). */
export const errorCodeSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'code en kebab-case')

/** Cuerpo de todo rechazo: `{ code, message, details? }` (ADR-BE-004 › Errores). */
export const errorBodySchema = z
  .object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
export type ErrorBody = z.infer<typeof errorBodySchema>

/**
 * Códigos transversales que emite la infraestructura del backend, con su status (ADR-BE-004).
 * Los códigos de regla de negocio (422) los agrega cada recurso.
 */
export const transversalErrorCodes = {
  'validation-error': 400,
  /** POST sin header Idempotency-Key, o con uno que no es UUID (ADR-BE-005 › Idempotencia). */
  'idempotency-key-required': 400,
  /** Filtro, orden o paginación fuera de la lista blanca del recurso (ADR-BE-004 › Orden y filtros). */
  'invalid-query': 400,
  unauthenticated: 401,
  forbidden: 403,
  'not-found': 404,
  'version-conflict': 409,
  /** La misma clave sigue en ejecución. Defensivo: con la clave registrada en la transacción del comando no se observa. */
  'idempotency-key-in-progress': 409,
  /** Misma Idempotency-Key con otro payload. */
  'idempotency-key-reused': 422,
  'internal-error': 500,
  'service-unavailable': 503,
} as const
export type TransversalErrorCode = keyof typeof transversalErrorCodes
