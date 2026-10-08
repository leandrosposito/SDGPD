import type { TransversalErrorCode } from '@sdgpd/contracts'

type Details = Record<string, unknown>

/**
 * Error de aplicación con su status y `code` (ADR-BE-004 › Errores). El filtro global lo traduce
 * a `{ code, message, details? }`. Todo lo que no sea AppError (ni HttpException) es un 500.
 */
export abstract class AppError extends Error {
  abstract readonly status: number
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Details,
  ) {
    super(message)
  }
}

/** 400: el request no cumple el schema de contracts. */
export class ValidationError extends AppError {
  readonly status = 400
  constructor(message: string, details?: Details) {
    super('validation-error' satisfies TransversalErrorCode, message, details)
  }
}

/** 404: el recurso no existe (o no es del tenant, que para el cliente es lo mismo). */
export class NotFoundError extends AppError {
  readonly status = 404
  constructor(entity: string) {
    super('not-found' satisfies TransversalErrorCode, `${entity} no existe`, { entity })
  }
}

/** 409: conflicto de versión o de concurrencia. */
export class ConflictError extends AppError {
  readonly status = 409
}

/** 422: regla de negocio. El `code` es el del vocabulario del recurso (ADR-BE-004, sub-decisión 3). */
export class BusinessRuleError extends AppError {
  readonly status = 422
}

/** 503: una dependencia (la base) no contesta. */
export class ServiceUnavailableError extends AppError {
  readonly status = 503
  constructor(message: string) {
    super('service-unavailable' satisfies TransversalErrorCode, message)
  }
}
