import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateUserRequest,
  createUserRequestSchema,
  idSchema,
  type UpdateUserRequest,
  updateUserRequestSchema,
  type User,
  type UserErrorCode,
  type UserListQuery,
  userListQuerySchema,
  type UserPage,
} from '@sdgpd/contracts'
import { and, count, eq, inArray, type SQL } from 'drizzle-orm'
import { hashPassword } from '../auth/passwords.ts'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { newId } from '../db/ids.ts'
import { orderByWhitelist, offsetPage } from '../db/pagination.ts'
import { isUniqueViolation } from '../db/pg-errors.ts'
import { branches, roles, userBranches, users } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { BusinessRuleError, ConflictError, NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import {
  assertAnAdminRemains,
  findUser,
  IDENTITY_LOCK,
  selectUserRows,
  toUsers,
  userBranchEntity,
  userEntity,
} from './identity.queries.ts'

/** El rol y las sucursales tienen que existir en la empresa (la FK compuesta lo garantiza; esto da un 422 con código). */
async function assertRoleAndBranches(tx: CommandTx, roleId: string, branchIds: string[]): Promise<void> {
  const role = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId))
  if (role.length === 0) throw new BusinessRuleError('role-not-found' satisfies UserErrorCode, 'El rol no existe')
  const unique = [...new Set(branchIds)]
  if (unique.length === 0) return
  const found = await tx.select({ n: count() }).from(branches).where(inArray(branches.id, unique))
  if ((found[0]?.n ?? 0) !== unique.length) {
    throw new BusinessRuleError('branch-not-found' satisfies UserErrorCode, 'Alguna de las sucursales no existe')
  }
}

/** Deja las sucursales habilitadas del usuario iguales a `branchIds` (filas hijas auditadas). */
async function syncBranches(tx: CommandTx, userId: string, empresaId: string, branchIds: string[]): Promise<void> {
  const wanted = new Set(branchIds)
  const current = await tx.select({ id: userBranches.id, branchId: userBranches.branchId }).from(userBranches).where(eq(userBranches.userId, userId))
  for (const row of current) {
    if (!wanted.has(row.branchId)) await tx.removeChild(userBranchEntity, row.id)
  }
  const existing = new Set(current.map(r => r.branchId))
  for (const branchId of wanted) {
    if (!existing.has(branchId)) await tx.insert(userBranchEntity, { id: newId(), empresaId, userId, branchId })
  }
}

/**
 * Gestión de usuarios (ADR-BE-003; BE-1a), módulo `settings`. Ninguna respuesta lleva el hash ni la
 * empresa; la auditoría excluye el hash (userEntity).
 */
@Controller('users')
export class UsersController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('settings', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(userListQuerySchema)) query: UserListQuery): Promise<UserPage> {
    return this.database.read(actor.empresaId, async r => {
      const where: SQL | undefined = and(
        query.active === undefined ? undefined : eq(users.active, query.active),
        query.roleId === undefined ? undefined : eq(users.roleId, query.roleId),
      )
      const page = await offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(users).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          selectUserRows(r.select, where)
            .orderBy(
              ...orderByWhitelist(
                { fullName: users.fullName, email: users.email, createdAt: users.createdAt },
                query.sortField,
                query.sortDirection,
                users.id,
              ),
            )
            .limit(limit)
            .offset(offset),
      })
      return { ...page, items: await toUsers(r.select, page.items) }
    })
  }

  /** Alta con contraseña inicial (argon2id). El email es único global: repetido, 409 `email-in-use`. */
  @Post()
  @RequirePermission('settings', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createUserRequestSchema)) body: CreateUserRequest): Promise<User> {
    await assertRoleAndBranches(tx, body.roleId, body.branchIds)
    const id = newId()
    try {
      await tx.insert(userEntity, {
        id,
        empresaId: tx.actor.empresaId,
        email: body.email,
        fullName: body.fullName,
        passwordHash: await hashPassword(body.password),
        roleId: body.roleId,
        active: body.active,
      })
    } catch (err) {
      if (isUniqueViolation(err, 'users_email_uk')) {
        throw new ConflictError('email-in-use' satisfies UserErrorCode, 'Ese email ya lo usa otro usuario')
      }
      throw err
    }
    await syncBranches(tx, id, tx.actor.empresaId, body.branchIds)
    const user = await findUser(tx.select, id)
    if (user === undefined) throw new Error('el usuario recién creado no es visible')
    return user
  }

  /**
   * Nombre, rol, activo y sucursales, con la versión leída (409 si cambió). Cambiar el rol sube
   * permissions_version (los tokens viejos dejan de valer). Desactivar revoca sus refresh tokens.
   * Si dejaría a la empresa sin un usuario activo con settings.editar: 422 `last-admin` (BE-1b).
   */
  @Put(':id')
  @RequirePermission('settings', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateUserRequestSchema)) body: UpdateUserRequest,
  ): Promise<User> {
    await tx.lockScope(IDENTITY_LOCK)
    const [current] = await tx
      .select({ roleId: users.roleId, active: users.active, permissionsVersion: users.permissionsVersion })
      .from(users)
      .where(eq(users.id, id))
    if (current === undefined) throw new NotFoundError('user')
    await assertRoleAndBranches(tx, body.roleId, body.branchIds)
    const roleChanged = current.roleId !== body.roleId
    await tx.update(userEntity, id, body.version, {
      fullName: body.fullName,
      roleId: body.roleId,
      active: body.active,
      permissionsVersion: roleChanged ? current.permissionsVersion + 1 : current.permissionsVersion,
    })
    await syncBranches(tx, id, tx.actor.empresaId, body.branchIds)
    if (current.active && !body.active) await tx.revokeRefreshTokens(id)
    await assertAnAdminRemains(tx)
    const user = await findUser(tx.select, id)
    if (user === undefined) throw new NotFoundError('user')
    return user
  }
}
