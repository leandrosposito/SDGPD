import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import type { ErrorBody, TransversalErrorCode } from '@sdgpd/contracts'
import { AppError } from './errors.ts'
import { requestIdOf } from './request-id.middleware.ts'

/** Status de una HttpException (las que tiran Nest o Express) → code. */
const CODE_BY_STATUS: Partial<Record<number, string>> = {
  400: 'validation-error',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not-found',
  405: 'method-not-allowed',
  409: 'version-conflict',
  413: 'payload-too-large',
  415: 'unsupported-media-type',
  422: 'business-rule',
  429: 'too-many-requests',
}

const INTERNAL_ERROR: { status: number; body: ErrorBody } = {
  status: 500,
  body: { code: 'internal-error' satisfies TransversalErrorCode, message: 'Error interno del servidor' },
}

/**
 * Filtro global: toda respuesta de error es `{ code, message, details? }` (ADR-BE-004 › Errores).
 * Lo no previsto es un 500 `internal-error`, sin stack ni mensaje interno en el cuerpo; el
 * detalle va solo al log, con el X-Request-Id para cruzarlo.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter')

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const { status, body } = toResponse(exception)
    if (status >= 500) {
      const detail = exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)
      this.logger.error(`[${requestIdOf(http.getRequest()) ?? '-'}] ${status} ${body.code}: ${detail}`)
    }
    this.adapterHost.httpAdapter.reply(http.getResponse(), body, status)
  }
}

function toResponse(exception: unknown): { status: number; body: ErrorBody } {
  if (exception instanceof AppError) {
    const body: ErrorBody = { code: exception.code, message: exception.message }
    if (exception.details) body.details = exception.details
    return { status: exception.status, body }
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    const code = CODE_BY_STATUS[status]
    if (status >= 500 || code === undefined) return INTERNAL_ERROR
    return { status, body: { code, message: messageOf(exception) } }
  }
  return INTERNAL_ERROR
}

/** Mensaje de una HttpException de Nest/Express, sin reenviar estructuras internas. */
function messageOf(exception: HttpException): string {
  const response = exception.getResponse()
  if (typeof response === 'string' && response !== '') return response
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const message = response.message
    if (typeof message === 'string' && message !== '') return message
  }
  return exception.message || 'Error'
}
