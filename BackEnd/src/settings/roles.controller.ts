import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common'
import {
  idSchema,
  type Role,
  type RoleListQuery,
  roleListQuerySchema,
  type RolePage,
  type UpdateRolePermissionsRequest,
  updateRolePermissionsRequestSchema,
} from '@sdgpd/contracts'
import { count, eq } from 'drizzle-orm'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import { permissionKey } from '../db/auth-store.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { newId } from '../db/ids.ts'
import { offsetPage, orderByWhitelist } from '../db/pagination.ts'
import { rolePermissions, roles, users } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { assertAnAdminRemains, IDENTITY_LOCK, roleEntity, rolePermissionEntity, toRoles, userEntity } from './identity.queries.ts'

const roleColumns = { id: roles.id, name: roles.name, version: roles.version }

/** Roles de la empresa y su matriz módulo × acción (ADR-BE-003 §Decisión 4; BE-1a), módulo `settings`. */
@Controller('roles')
export class RolesController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('settings', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(roleListQuerySchema)) query: RoleListQuery): Promise<RolePage> {
    return this.database.read(actor.empresaId, async r => {
      const page = await offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(roles))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          r
            .select(roleColumns)
            .from(roles)
            .orderBy(...orderByWhitelist({ name: roles.name }, query.sortField, query.sortDirection, roles.id))
            .limit(limit)
            .offset(offset),
      })
      return { ...page, items: await toRoles(r.select, page.items) }
    })
  }

  /**
   * Reemplaza la matriz del rol, con la versión leída (409 si cambió). Si la matriz cambia, sube
   * permissions_version de cada usuario del rol: sus access tokens dejan de valer en el próximo
   * request (el guard compara `ver`) y el refresh emite uno con los permisos nuevos.
   * Si dejaría a la empresa sin un usuario activo con settings.editar: 422 `last-admin` (BE-1b).
   */
  @Put(':id/permissions')
  @RequirePermission('settings', 'editar')
  async updatePermissions(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateRolePermissionsRequestSchema)) body: UpdateRolePermissionsRequest,
  ): Promise<Role> {
    await tx.lockScope(IDENTITY_LOCK)
    await tx.update(roleEntity, id, body.version, {})
    const wanted = new Map(body.permissions.map(p => [permissionKey(p.module, p.action), p]))
    const current = await tx
      .select({ id: rolePermissions.id, module: rolePermissions.module, action: rolePermissions.action })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, id))
    const currentKeys = new Set(current.map(p => permissionKey(p.module, p.action)))
    let changed = false
    for (const row of current) {
      if (!wanted.has(permissionKey(row.module, row.action))) {
        await tx.removeChild(rolePermissionEntity, row.id)
        changed = true
      }
    }
    for (const [key, p] of wanted) {
      if (!currentKeys.has(key)) {
        await tx.insert(rolePermissionEntity, { id: newId(), empresaId: tx.actor.empresaId, roleId: id, module: p.module, action: p.action })
        changed = true
      }
    }
    if (changed) {
      const members = await tx
        .select({ id: users.id, version: users.version, permissionsVersion: users.permissionsVersion })
        .from(users)
        .where(eq(users.roleId, id))
      for (const member of members) {
        await tx.update(userEntity, member.id, member.version, { permissionsVersion: member.permissionsVersion + 1 })
      }
    }
    await assertAnAdminRemains(tx)
    const [role] = await toRoles(tx.select, await tx.select(roleColumns).from(roles).where(eq(roles.id, id)))
    if (role === undefined) throw new NotFoundError('role')
    return role
  }
}
