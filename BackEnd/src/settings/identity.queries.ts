import type { Permission, Role, User, UserErrorCode } from '@sdgpd/contracts'
import { and, asc, count, eq, exists, inArray, type SQL } from 'drizzle-orm'
import { auditedEntity, type CommandTx } from '../db/command.ts'
import { BusinessRuleError } from '../http/errors.ts'
import { branches, rolePermissions, roles, userBranches, users } from '../db/schema/index.ts'
import type { TenantTx } from '../db/tenant-tx.ts'

/** Entidades auditadas de identidad. El hash de la contraseña nunca va a audit_log (ADR-BE-005, sub-decisión 7). */
export const userEntity = auditedEntity(users, 'user', ['passwordHash'])
export const userBranchEntity = auditedEntity(userBranches, 'user-branch')
export const roleEntity = auditedEntity(roles, 'role')
export const rolePermissionEntity = auditedEntity(rolePermissions, 'role-permission')

/** Lecturas: tanto `Database.read()` como `CommandTx` exponen el mismo `select`. */
export type Select = TenantTx['select']

/** timestamptz en modo string (`2026-10-09 17:02:39.12+00`) → instante ISO UTC del contrato (ADR-BE-004). */
export function toInstant(value: string): string {
  return new Date(value).toISOString()
}

/** Las columnas públicas de un usuario: nunca el hash. */
const userColumns = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  roleId: users.roleId,
  active: users.active,
  version: users.version,
  createdAt: users.createdAt,
}
export type UserRow = { id: string; email: string; fullName: string; roleId: string; active: boolean; version: number; createdAt: string }

/** Sucursales habilitadas de cada usuario de la lista. */
async function branchIdsOf(select: Select, userIds: string[]): Promise<Map<string, string[]>> {
  const byUser = new Map<string, string[]>(userIds.map(id => [id, []]))
  if (userIds.length === 0) return byUser
  const rows = await select({ userId: userBranches.userId, branchId: userBranches.branchId })
    .from(userBranches)
    .where(inArray(userBranches.userId, userIds))
    .orderBy(asc(userBranches.branchId))
  for (const row of rows) byUser.get(row.userId)?.push(row.branchId)
  return byUser
}

/** Usuarios (página o uno) con sus sucursales, en el formato del contrato. */
export async function toUsers(select: Select, rows: UserRow[]): Promise<User[]> {
  const branchIds = await branchIdsOf(
    select,
    rows.map(r => r.id),
  )
  return rows.map(r => ({ ...r, createdAt: toInstant(r.createdAt), branchIds: branchIds.get(r.id) ?? [] }))
}

export function selectUserRows(select: Select, where: SQL | undefined) {
  return select(userColumns).from(users).where(where)
}

export async function findUser(select: Select, id: string): Promise<User | undefined> {
  const rows = await selectUserRows(select, eq(users.id, id))
  return (await toUsers(select, rows))[0]
}

/** Matriz de cada rol de la lista. */
export async function toRoles(select: Select, rows: { id: string; name: string; version: number }[]): Promise<Role[]> {
  const byRole = new Map<string, Permission[]>(rows.map(r => [r.id, []]))
  if (rows.length > 0) {
    const permissions = await select({ roleId: rolePermissions.roleId, module: rolePermissions.module, action: rolePermissions.action })
      .from(rolePermissions)
      .where(
        inArray(
          rolePermissions.roleId,
          rows.map(r => r.id),
        ),
      )
      .orderBy(asc(rolePermissions.module), asc(rolePermissions.action))
    for (const p of permissions) byRole.get(p.roleId)?.push({ module: p.module, action: p.action })
  }
  return rows.map(r => ({ ...r, permissions: byRole.get(r.id) ?? [] }))
}

/** Scope del lock que serializa los cambios de usuarios y de matrices de una empresa. */
export const IDENTITY_LOCK = 'identity'

/**
 * Guarda contra el autobloqueo (BE-1b): después de cambiar usuarios o matrices, en la misma
 * transacción, la empresa tiene que seguir teniendo al menos un usuario activo con `settings.editar`.
 * Si no, 422 `last-admin` y el comando se revierte entero. Quien llama toma antes
 * `tx.lockScope(IDENTITY_LOCK)`, así dos cambios concurrentes no pueden pasar el chequeo a la vez.
 */
export async function assertAnAdminRemains(tx: CommandTx): Promise<void> {
  const editor = tx
    .select({ id: rolePermissions.id })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, users.roleId), eq(rolePermissions.module, 'settings'), eq(rolePermissions.action, 'editar')))
  const [row] = await tx.select({ n: count() }).from(users).where(and(eq(users.active, true), exists(editor)))
  if ((row?.n ?? 0) === 0) {
    throw new BusinessRuleError(
      'last-admin' satisfies UserErrorCode,
      'El cambio dejaría a la empresa sin ningún usuario activo que pueda editar usuarios y permisos',
    )
  }
}

export const branchColumns = {
  id: branches.id,
  name: branches.name,
  code: branches.code,
  city: branches.city,
  address: branches.address,
  status: branches.status,
}
