import type { IncomingMessage, ServerResponse } from 'node:http'
import { Injectable, type NestMiddleware } from '@nestjs/common'
import { newId } from '../db/ids.ts'

export const REQUEST_ID_HEADER = 'X-Request-Id'
const CLIENT_REQUEST_ID_MAX_LENGTH = 200

type WithRequestId = IncomingMessage & { requestId?: string; clientRequestId?: string }

/**
 * X-Request-Id (ADR-BE-005, sub-decisión 6): el servidor genera un UUID v7 por request y lo
 * devuelve en el header. Si el cliente manda uno, se conserva aparte como clientRequestId
 * (truncado) y no reemplaza al del servidor.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware<WithRequestId, ServerResponse> {
  use(req: WithRequestId, res: ServerResponse, next: () => void): void {
    const id = newId()
    req.requestId = id
    const fromClient = req.headers[REQUEST_ID_HEADER.toLowerCase()]
    if (typeof fromClient === 'string' && fromClient !== '') {
      req.clientRequestId = fromClient.slice(0, CLIENT_REQUEST_ID_MAX_LENGTH)
    }
    res.setHeader(REQUEST_ID_HEADER, id)
    next()
  }
}

export function requestIdOf(request: unknown): string | undefined {
  if (typeof request === 'object' && request !== null && 'requestId' in request) {
    const id = request.requestId
    if (typeof id === 'string') return id
  }
  return undefined
}
