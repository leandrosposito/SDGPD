import { z } from 'zod'
import { branchSchema } from './branches.ts'
import { idSchema } from './id.ts'
import { instantSchema } from './time.ts'

/**
 * Módulos de la matriz de permisos: los 10 de `FrontEnd/src/modules/` (ADR-BE-003, sub-decisión 6).
 * Incluye compras y settings (hallazgo M12).
 */
export const MODULES = [
  'analytics',
  'cash',
  'clients',
  'compras',
  'dashboard',
  'inventory',
  'logistics',
  'orders',
  'settings',
  'suppliers',
] as const
export const moduleSchema = z.enum(MODULES)
export type Module = z.infer<typeof moduleSchema>

/** Acciones de la matriz (ADR-BE-003, sub-decisión 6). `forzar` es el override de capacidad de ADR-011. */
export const ACTIONS = ['ver', 'crear', 'editar', 'anular', 'aprobar', 'exportar', 'forzar'] as const
export const actionSchema = z.enum(ACTIONS)
export type Action = z.infer<typeof actionSchema>

/** Un permiso de la matriz: módulo × acción. */
export const permissionSchema = z.object({ module: moduleSchema, action: actionSchema }).strict()
export type Permission = z.infer<typeof permissionSchema>

/** Email normalizado (sin espacios, en minúsculas): único global (ADR-BE-003, sub-decisión 7). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

/** Tipo de cliente que declara el login: decide dónde viaja el refresh (ADR-BE-003 §Decisión 1). */
export const clientTypeSchema = z.enum(['web', 'native'])
export type ClientType = z.infer<typeof clientTypeSchema>

/** POST /auth/login. La contraseña no se valida contra la política acá: eso es del alta. */
export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(1024),
    clientType: clientTypeSchema,
  })
  .strict()
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** GET /auth/session (ADR-BE-003 §Decisión 3): usuario, empresa, rol, permisos efectivos y sucursales habilitadas. */
export const sessionSchema = z
  .object({
    user: z.object({ id: idSchema, email: z.string(), fullName: z.string() }).strict(),
    company: z.object({ id: idSchema, name: z.string(), timezone: z.string() }).strict(),
    role: z.object({ id: idSchema, name: z.string() }).strict(),
    permissions: z.array(permissionSchema),
    branches: z.array(branchSchema),
  })
  .strict()
export type Session = z.infer<typeof sessionSchema>

/** Access token (JWT, 15 minutos; ADR-BE-003, sub-decisión 2). Se guarda en memoria del cliente. */
export const accessTokenResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresAt: instantSchema,
  })
  .strict()
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>

/** Respuesta de POST /auth/login (rama web): access token y sesión. El refresh va en la cookie. */
export const loginResponseSchema = accessTokenResponseSchema.extend({ session: sessionSchema }).strict()
export type LoginResponse = z.infer<typeof loginResponseSchema>

/** Respuesta de POST /auth/refresh: un access token nuevo (el refresh rotado va en la cookie). */
export const refreshResponseSchema = accessTokenResponseSchema
export type RefreshResponse = AccessTokenResponse

/** Header que exige POST /auth/refresh (ADR-BE-003, sub-decisión 4). */
export const REQUESTED_WITH_HEADER = 'X-Requested-With'

/** Códigos de error de autenticación y permisos, con su status. */
export const authErrorCodes = {
  /** Email inexistente, contraseña incorrecta, usuario inactivo o bloqueado: el mismo código y el mismo mensaje. */
  'invalid-credentials': 401,
  /** POST /auth/refresh sin X-Requested-With. */
  'csrf-header-required': 403,
  /** `branchId` de una sucursal que el usuario no tiene habilitada (ADR-BE-002 §Decisión 3). */
  'branch-not-enabled': 403,
  /** La rama nativa del login, hasta que exista la app (ADR-BE-003, objeción 1). */
  'not-implemented': 501,
} as const
export type AuthErrorCode = keyof typeof authErrorCodes
