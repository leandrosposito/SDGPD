import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import { idSchema } from '@sdgpd/contracts'
import { UnauthenticatedError } from '../http/errors.ts'
import { requestIdOf } from '../http/request-id.middleware.ts'

/**
 * Quién ejecuta (ADR-BE-003: el actor sale de la sesión). Lo necesitan la idempotencia (alcance
 * empresa + usuario) y la auditoría (quién y con qué request).
 */
export type Actor = { empresaId: string; userId: string; requestId: string }

const actors = new WeakMap<object, Actor>()

/**
 * ÚNICO punto de entrada para fijar el actor de un request. En BE-1 lo llama la autenticación, con
 * la empresa y el usuario de la sesión. En BE-0b no lo llama nada de src/: solo el guard de prueba de
 * test/. No existe ninguna forma de fijarlo desde un header, una query o un body.
 */
export function bindActor(request: object, identity: { empresaId: string; userId: string }): Actor {
  const requestId = requestIdOf(request)
  if (requestId === undefined) throw new Error('bindActor: el request no pasó por RequestIdMiddleware')
  const actor: Actor = {
    empresaId: idSchema.parse(identity.empresaId),
    userId: idSchema.parse(identity.userId),
    requestId,
  }
  actors.set(request, actor)
  return actor
}

export function actorOf(request: object): Actor | undefined {
  return actors.get(request)
}

export function requireActor(request: object): Actor {
  const actor = actorOf(request)
  if (actor === undefined) throw new UnauthenticatedError()
  return actor
}

/** `@CurrentActor() actor: Actor` en un handler. Sin actor, 401 `unauthenticated`. */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request: object = ctx.switchToHttp().getRequest()
  return requireActor(request)
})
