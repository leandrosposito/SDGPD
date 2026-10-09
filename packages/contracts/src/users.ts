import { z } from 'zod'
import { emailSchema, permissionSchema } from './auth.ts'
import { idSchema, versionSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'
import { instantSchema } from './time.ts'

/** Política de la contraseña inicial (ADR-BE-003, sub-decisiones de BE-1a). */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 256
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

/**
 * Usuario (ADR-BE-003 §Decisión 2: `SessionUser` y `UserAccount` son proyecciones de esta tabla).
 * Nunca lleva el hash de la contraseña ni la empresa.
 */
export const userSchema = z
  .object({
    id: idSchema,
    email: z.string(),
    fullName: z.string(),
    roleId: idSchema,
    active: z.boolean(),
    branchIds: z.array(idSchema),
    version: versionSchema,
    createdAt: instantSchema,
  })
  .strict()
export type User = z.infer<typeof userSchema>

/** POST /users: alta con contraseña inicial. */
export const createUserRequestSchema = z
  .object({
    email: emailSchema,
    fullName: z.string().trim().min(1).max(200),
    password: passwordSchema,
    roleId: idSchema,
    branchIds: z.array(idSchema).max(100),
    active: z.boolean().default(true),
  })
  .strict()
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>

/** PUT /users/{id}: nombre, rol, activo y sucursales, con la versión leída. El email no se edita. */
export const updateUserRequestSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    roleId: idSchema,
    active: z.boolean(),
    branchIds: z.array(idSchema).max(100),
    version: versionSchema,
  })
  .strict()
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>

/** GET /users: lista blanca. */
export const userListQuerySchema = offsetListQuerySchema({
  sortFields: ['fullName', 'email', 'createdAt'],
  defaultSort: 'fullName',
  filters: {
    active: z.enum(['true', 'false']).transform(v => v === 'true'),
    roleId: idSchema,
  },
})
export type UserListQuery = z.infer<typeof userListQuerySchema>

export const userPageSchema = offsetPageSchema(userSchema)
export type UserPage = z.infer<typeof userPageSchema>

/** Rol de la empresa con su matriz (ADR-BE-003 §Decisión 4, sub-decisión 5). */
export const roleSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    version: versionSchema,
    permissions: z.array(permissionSchema),
  })
  .strict()
export type Role = z.infer<typeof roleSchema>

/** PUT /roles/{id}/permissions: la matriz completa del rol (reemplaza la anterior), con la versión leída. */
export const updateRolePermissionsRequestSchema = z
  .object({
    permissions: z.array(permissionSchema).max(100),
    version: versionSchema,
  })
  .strict()
export type UpdateRolePermissionsRequest = z.infer<typeof updateRolePermissionsRequestSchema>

/** GET /roles: lista blanca. */
export const roleListQuerySchema = offsetListQuerySchema({ sortFields: ['name'], defaultSort: 'name', filters: {} })
export type RoleListQuery = z.infer<typeof roleListQuerySchema>

export const rolePageSchema = offsetPageSchema(roleSchema)
export type RolePage = z.infer<typeof rolePageSchema>

/** Códigos de error de usuarios y roles. */
export const userErrorCodes = {
  /** El email ya lo usa otro usuario (es único global). */
  'email-in-use': 409,
  'role-not-found': 422,
  'branch-not-found': 422,
} as const
export type UserErrorCode = keyof typeof userErrorCodes
