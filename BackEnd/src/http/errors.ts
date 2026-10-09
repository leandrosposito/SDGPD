import type { AuthErrorCode, TransversalErrorCode } from '@sdgpd/contracts'

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

/** 400: falta la Idempotency-Key de un POST, o no es UUID (ADR-BE-005 › Idempotencia). */
export class IdempotencyKeyRequiredError extends AppError {
  readonly status = 400
  constructor() {
    super('idempotency-key-required' satisfies TransversalErrorCode, 'Todo POST lleva el header Idempotency-Key con un UUID')
  }
}

/** 400: query fuera de la lista blanca del recurso (ADR-BE-004 › Orden y filtros). */
export class InvalidQueryError extends AppError {
  readonly status = 400
  constructor(details?: Details) {
    super('invalid-query' satisfies TransversalErrorCode, 'Los parámetros del listado no son válidos', details)
  }
}

/** 401: sin sesión válida (sin access token, token inválido o vencido, usuario inactivo o con permisos cambiados). */
export class UnauthenticatedError extends AppError {
  readonly status = 401
  constructor() {
    super('unauthenticated' satisfies TransversalErrorCode, 'Hace falta una sesión')
  }
}

/**
 * 401 del login: el MISMO código y el MISMO mensaje para email inexistente, contraseña incorrecta,
 * usuario inactivo y usuario bloqueado por intentos fallidos (no revela qué emails existen).
 */
export class InvalidCredentialsError extends AppError {
  readonly status = 401
  constructor() {
    super('invalid-credentials' satisfies AuthErrorCode, 'Email o contraseña incorrectos')
  }
}

/** 403: hay sesión, pero no alcanza (permiso, sucursal no habilitada, header de CSRF). */
export class ForbiddenError extends AppError {
  readonly status = 403
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

/** 422: misma Idempotency-Key con otro payload. */
export class IdempotencyKeyReusedError extends AppError {
  readonly status = 422
  constructor() {
    super('idempotency-key-reused' satisfies TransversalErrorCode, 'La Idempotency-Key ya se usó con otro payload')
  }
}

/** 422: regla de negocio. El `code` es el del vocabulario del recurso (ADR-BE-004, sub-decisión 3). */
export class BusinessRuleError extends AppError {
  readonly status = 422
}

/** 501: parte del contrato que todavía no tiene implementación (la rama nativa del login). */
export class NotImplementedError extends AppError {
  readonly status = 501
  constructor(message: string) {
    super('not-implemented' satisfies AuthErrorCode, message)
  }
}

/** 503: una dependencia (la base) no contesta. */
export class ServiceUnavailableError extends AppError {
  readonly status = 503
  constructor(message: string) {
    super('service-unavailable' satisfies TransversalErrorCode, message)
  }
}
