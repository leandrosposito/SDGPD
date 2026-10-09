import { Inject, Injectable, type OnModuleInit, RequestMethod } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants.js'
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { PathsExplorer } from '@nestjs/core/router/paths-explorer.js'
import { ROUTE_ALLOWLIST, ROUTE_POLICY_METADATA, type RouteAllowlist, type RoutePolicy } from './route-policy.ts'

/** `/a/` + `/b/:id` → `/a/b/:id`. */
function joinPath(...parts: string[]): string {
  const joined = `/${parts.join('/')}`.replace(/\/+/g, '/')
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined
}

function pathsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return ['']
}

/**
 * Verificación de arranque (ADR-BE-003, sub-decisión 6): recorre TODAS las rutas registradas y hace
 * fallar el arranque (app.init / listen) si alguna no declara su política, o si declara `@Public()` o
 * `@SessionOnly()` sin estar en su lista. Así un endpoint nuevo no puede quedar abierto por olvido.
 */
@Injectable()
export class RoutePolicyCheck implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(ROUTE_ALLOWLIST) private readonly allowlist: RouteAllowlist,
  ) {}

  onModuleInit(): void {
    const problems: string[] = []
    const explorer = new PathsExplorer(this.scanner)
    for (const wrapper of this.discovery.getControllers()) {
      const instance: unknown = wrapper.instance
      const controller = wrapper.metatype
      if (typeof instance !== 'object' || instance === null || typeof controller !== 'function') continue
      const prefixes = pathsOf(this.reflector.get<unknown>(PATH_METADATA, controller))
      for (const route of explorer.scanForPaths(instance)) {
        const method = RequestMethod[route.requestMethod]
        const policy = this.reflector.getAllAndOverride<RoutePolicy | undefined>(ROUTE_POLICY_METADATA, [
          route.targetCallback,
          controller,
        ])
        for (const prefix of prefixes) {
          for (const path of route.path) {
            const name = `${method} ${joinPath(prefix, path)}`
            if (policy === undefined) problems.push(`${name} (${controller.name}.${route.methodName}) no declara permiso`)
            else if (policy.kind === 'public' && !this.allowlist.public.includes(name)) {
              problems.push(`${name} está marcada @Public() y no es una ruta pública`)
            } else if (policy.kind === 'session' && !this.allowlist.sessionOnly.includes(name)) {
              problems.push(`${name} está marcada @SessionOnly() y no está en SESSION_ROUTES`)
            }
          }
        }
      }
    }
    if (problems.length > 0) {
      throw new Error(`Rutas sin política de acceso válida (ADR-BE-003, sub-decisión 6):\n  - ${problems.join('\n  - ')}`)
    }
  }
}
