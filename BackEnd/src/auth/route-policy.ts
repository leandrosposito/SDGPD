import { SetMetadata } from '@nestjs/common'
import type { Action, Module } from '@sdgpd/contracts'

/**
 * Qué exige una ruta (ADR-BE-003, sub-decisión 6). Toda ruta declara exactamente una:
 * - `permission`: sesión válida + el permiso módulo × acción en la matriz del rol;
 * - `session`: sesión válida, sin permiso de módulo (solo las de SESSION_ROUTES);
 * - `public`: sin sesión (solo las de PUBLIC_ROUTES).
 * Una ruta sin política hace fallar el arranque (RoutePolicyCheck).
 */
export type RoutePolicy =
  | { kind: 'public' }
  | { kind: 'session' }
  | { kind: 'permission'; module: Module; action: Action }

export const ROUTE_POLICY_METADATA = 'sdgpd:route-policy'

/** El endpoint exige el permiso `module.action` (403 `forbidden` si el rol no lo tiene). */
export const RequirePermission = (module: Module, action: Action) =>
  SetMetadata(ROUTE_POLICY_METADATA, { kind: 'permission', module, action } satisfies RoutePolicy)

/** Sin sesión. Solo lo pueden usar las rutas de PUBLIC_ROUTES: cualquier otra hace fallar el arranque. */
export const Public = () => SetMetadata(ROUTE_POLICY_METADATA, { kind: 'public' } satisfies RoutePolicy)

/** Con sesión y sin permiso de módulo. Solo para las rutas de SESSION_ROUTES. */
export const SessionOnly = () => SetMetadata(ROUTE_POLICY_METADATA, { kind: 'session' } satisfies RoutePolicy)

/** Las únicas rutas públicas (`MÉTODO /path`, con el prefijo global /api, BE-1b). */
export const PUBLIC_ROUTES: readonly string[] = ['GET /api/health', 'POST /api/auth/login', 'POST /api/auth/refresh', 'POST /api/auth/logout']

/**
 * Las únicas rutas con sesión y sin permiso de módulo: la sesión misma y las sucursales, que todo
 * usuario necesita para elegir dónde opera (GET /branches filtra por permiso adentro).
 */
export const SESSION_ROUTES: readonly string[] = ['GET /api/auth/session', 'GET /api/branches']

/** Token de las listas de arriba: los tests de infraestructura agregan sus rutas de prueba. */
export const ROUTE_ALLOWLIST = Symbol('ROUTE_ALLOWLIST')
export type RouteAllowlist = { public: readonly string[]; sessionOnly: readonly string[] }
export const DEFAULT_ROUTE_ALLOWLIST: RouteAllowlist = { public: PUBLIC_ROUTES, sessionOnly: SESSION_ROUTES }
