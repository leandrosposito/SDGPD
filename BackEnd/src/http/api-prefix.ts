import type { INestApplication } from '@nestjs/common'

/**
 * Prefijo global de todas las rutas (BE-1b): `/api/health`, `/api/auth/login`, `/api/users`…
 * El frontend las llama por el mismo origen (proxy de Vite en desarrollo, sin reescribir la ruta), así
 * que el path que ve el navegador es el mismo que ve el backend, y la cookie de refresh
 * (`Path=/api/auth/refresh`) viaja sin configuración extra (ADR-BE-003, objeción 2).
 */
export const API_PREFIX = 'api'

/** `/auth/login` → `/api/auth/login`. */
export function apiPath(path: string): string {
  return `/${API_PREFIX}/${path.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/'
}

/** Lo que toda app (la de main.ts y las de los tests) aplica antes de init/listen. Un solo lugar. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX)
}
