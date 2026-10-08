import type { ServerResponse } from 'node:http'
import {
  type CallHandler,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { idSchema } from '@sdgpd/contracts'
import { from, lastValueFrom, map, type Observable } from 'rxjs'
import { requireActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { payloadHash } from '../db/idempotency.ts'
import { IdempotencyKeyRequiredError } from './errors.ts'

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key'
export const IDEMPOTENT_REPLAY_HEADER = 'Idempotent-Replayed'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
/** `/auth/*` queda exento (ADR-BE-005, resolución de la objeción 1): sin idempotencia y sin transacción de comando. */
const AUTH_PREFIX = '/auth/'

type CommandRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  route?: { path?: unknown }
}

const commandTxs = new WeakMap<object, CommandTx>()

/** Plantilla de la ruta que matcheó (`/orders/:id/cancel`), no la URL concreta (ADR-BE-005, sub-decisión 1). */
function routeTemplate(request: CommandRequest): string {
  const path = request.route?.path
  if (typeof path !== 'string') throw new Error('CommandInterceptor: el request no tiene ruta resuelta')
  return path
}

/**
 * Toda mutación (POST, PUT, PATCH, DELETE) fuera de `/auth/*` es un comando: una transacción con el
 * tenant del actor (ADR-BE-005 › Transacciones), cuyo CommandTx recibe el handler con `@Command()`.
 * Todo POST, además, es idempotente: exige `Idempotency-Key` (UUID) y registra la clave en la misma
 * transacción. Sin actor, 401; sin clave válida, 400 `idempotency-key-required`.
 *
 * El status guardado es el que fijó la ruta (Nest lo aplica antes de los interceptores) y en el
 * replay Nest vuelve a aplicar el de la ruta: coinciden mientras la ruta no cambie su @HttpCode.
 */
@Injectable()
export class CommandInterceptor implements NestInterceptor {
  constructor(private readonly database: Database) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()
    const http = context.switchToHttp()
    const request = http.getRequest<CommandRequest>()
    const response = http.getResponse<ServerResponse>()
    const method = request.method ?? ''
    if (!MUTATING_METHODS.has(method)) return next.handle()
    const route = routeTemplate(request)
    if (route.startsWith(AUTH_PREFIX)) return next.handle()

    const actor = requireActor(request)
    const runHandler = async (tx: CommandTx): Promise<unknown> => {
      commandTxs.set(request, tx)
      try {
        return await lastValueFrom(next.handle(), { defaultValue: undefined })
      } finally {
        commandTxs.delete(request)
      }
    }

    if (method !== 'POST') return from(this.database.command(actor, runHandler))

    const header = request.headers[IDEMPOTENCY_KEY_HEADER]
    const key = idSchema.safeParse(header)
    if (!key.success) throw new IdempotencyKeyRequiredError()
    const idempotency = { operation: `${method} ${route}`, key: key.data, payloadHash: payloadHash(request.body) }
    return from(
      this.database.idempotentCommand(actor, idempotency, async tx => {
        const body = await runHandler(tx)
        return { status: response.statusCode, body }
      }),
    ).pipe(
      map(({ replayed, response: stored }) => {
        if (replayed) response.setHeader(IDEMPOTENT_REPLAY_HEADER, 'true')
        return stored.body
      }),
    )
  }
}

/** `@Command() tx: CommandTx` en el handler de una mutación: la transacción del comando en curso. */
export const Command = createParamDecorator((_data: unknown, ctx: ExecutionContext): CommandTx => {
  const request: object = ctx.switchToHttp().getRequest()
  const tx = commandTxs.get(request)
  if (tx === undefined) throw new Error('@Command() fuera de una mutación (o en una ruta /auth/*)')
  return tx
})
