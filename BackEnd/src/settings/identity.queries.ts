import type { Branch, Permission, Role, User } from '@sdgpd/contracts'
import { asc, eq, inArray, type SQL } from 'drizzle-orm'
import { auditedEntity } from '../db/command.ts'
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

export const branchColumns = {
  id: branches.id,
  name: branches.name,
  code: branches.code,
  city: branches.city,
  address: branches.address,
  status: branches.status,
}
export type BranchRow = Branch
