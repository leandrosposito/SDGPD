import { type CanActivate, createParamDecorator, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthErrorCode } from '@sdgpd/contracts'
import { bindActor } from '../context/actor.ts'
import { AuthStore, type Principal, permissionKey } from '../db/auth-store.ts'
import { ForbiddenError, UnauthenticatedError } from '../http/errors.ts'
import { ROUTE_POLICY_METADATA, type RoutePolicy } from './route-policy.ts'
import { bearerToken, TokenService } from './tokens.ts'

type GuardedRequest = {
  headers: Record<string, string | string[] | undefined>
  query?: unknown
  body?: unknown
}

const principals = new WeakMap<object, Principal>()

/** `branchId` de la query o del body, si viene (ADR-BE-002 §Decisión 3: nunca en el path). */
function requestedBranchIds(request: GuardedRequest): unknown[] {
  const found: unknown[] = []
  for (const source of [request.query, request.body]) {
    if (typeof source === 'object' && source !== null && 'branchId' in source) found.push(source.branchId)
  }
  return found
}

/**
 * Guard global (ADR-BE-003; BE-1a). Según la política de la ruta (route-policy.ts):
 * - pública: pasa sin tocar nada;
 * - si no: exige `Authorization: Bearer` con un access token válido, y con el tenant del token comprueba
 *   que el usuario exista EN esa empresa, esté activo y que `rol` y `ver` coincidan con su rol y su
 *   permissions_version actuales (cambiar permisos invalida los tokens viejos). Cualquier falla: 401.
 * Después fija el actor con bindActor (el único punto de entrada, BE-0b), exige el permiso de la ruta
 * (403 `forbidden`) y, si el request trae `branchId` en la query o el body, que esa sucursal esté
 * habilitada para el usuario (403 `branch-not-enabled`).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly store: AuthStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true
    const policy = this.reflector.getAllAndOverride<RoutePolicy | undefined>(ROUTE_POLICY_METADATA, [
      context.getHandler(),
      context.getClass(),
    ])
    // Sin política no hay ruta: RoutePolicyCheck no deja arrancar. Defensa por si llegara una.
    if (policy === undefined) throw new UnauthenticatedError()
    if (policy.kind === 'public') return true

    const request = context.switchToHttp().getRequest<GuardedRequest>()
    const authorization = request.headers.authorization
    const token = bearerToken(typeof authorization === 'string' ? authorization : undefined)
    if (token === undefined) throw new UnauthenticatedError()
    const claims = await this.tokens.verify(token)
    if (claims === null) throw new UnauthenticatedError()
    const principal = await this.store.loadPrincipal(claims.emp, claims.sub)
    if (
      principal === null ||
      !principal.active ||
      principal.roleId !== claims.rol ||
      principal.permissionsVersion !== claims.ver
    ) {
      throw new UnauthenticatedError()
    }

    bindActor(request, { empresaId: principal.empresaId, userId: principal.userId })
    principals.set(request, principal)

    if (policy.kind === 'permission' && !principal.permissions.has(permissionKey(policy.module, policy.action))) {
      throw new ForbiddenError('forbidden', 'No tenés permiso para esta acción', { module: policy.module, action: policy.action })
    }
    for (const branchId of requestedBranchIds(request)) {
      if (typeof branchId !== 'string' || !principal.branchIds.has(branchId)) {
        throw new ForbiddenError('branch-not-enabled' satisfies AuthErrorCode, 'La sucursal no está habilitada para tu usuario')
      }
    }
    return true
  }
}

/** El usuario autenticado del request (solo en rutas con sesión). */
export function principalOf(request: object): Principal {
  const principal = principals.get(request)
  if (principal === undefined) throw new UnauthenticatedError()
  return principal
}

/** `@CurrentPrincipal() principal: Principal` en un handler con sesión. */
export const CurrentPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => {
  const request: object = ctx.switchToHttp().getRequest()
  return principalOf(request)
})
