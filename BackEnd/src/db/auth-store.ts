import { Injectable } from '@nestjs/common'
import { type Action, actionSchema, type Branch, type Module, moduleSchema } from '@sdgpd/contracts'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { Database } from './database.ts'
import { newId } from './ids.ts'
import { insertRefreshToken, revokeFamily } from './refresh-tokens.ts'
import { branches, companies, loginAttempts, refreshTokens, rolePermissions, roles, userBranches, users } from './schema/index.ts'

/** Bloqueo por intentos fallidos (BE-1a): 5 fallos dentro de 15 minutos bloquean el login 15 minutos. */
export const LOGIN_MAX_FAILURES = 5
export const LOGIN_FAILURE_WINDOW = '15 minutes'
export const LOGIN_LOCK_DURATION = '15 minutes'

/** Permiso como clave de un Set: `orders.crear`. */
export type PermissionKey = `${Module}.${Action}`
export const permissionKey = (module: Module, action: Action): PermissionKey => `${module}.${action}`

/** Lo que el guard necesita de un usuario en cada request: se lee siempre con el tenant del token. */
export type Principal = {
  userId: string
  empresaId: string
  roleId: string
  active: boolean
  permissionsVersion: number
  permissions: ReadonlySet<PermissionKey>
  branchIds: ReadonlySet<string>
}

const principalRowSchema = z.object({
  id: z.uuid(),
  role_id: z.uuid(),
  active: z.boolean(),
  permissions_version: z.number().int(),
  permissions: z.array(z.object({ module: moduleSchema, action: actionSchema })),
  branch_ids: z.array(z.uuid()),
})

/** Resultado de rotar un refresh token. `reused`: se presentó uno ya usado y la familia quedó revocada. */
export type RotationResult =
  | { kind: 'rotated'; empresaId: string; userId: string; familyId: string }
  | { kind: 'reused' }
  | { kind: 'invalid' }

/** Lo que devuelve GET /auth/session, sin el formato del contrato. */
export type SessionData = {
  user: { id: string; email: string; fullName: string }
  company: { id: string; name: string; timezone: string }
  role: { id: string; name: string }
  permissions: { module: Module; action: Action }[]
  branches: Branch[]
}

/**
 * Persistencia de la autenticación (ADR-BE-003). Todo pasa con el tenant fijado, salvo las dos
 * búsquedas por función SECURITY DEFINER de Database (findLoginUser, findRefreshToken). Estas tablas
 * (refresh_tokens, login_attempts) son infraestructura de la sesión, como idempotency_keys: no pasan
 * por audit_log. Lo que cambia un usuario o un rol sí (CommandTx).
 */
@Injectable()
export class AuthStore {
  constructor(private readonly database: Database) {}

  /** ¿El usuario está bloqueado por intentos fallidos ahora? */
  async isLocked(empresaId: string, userId: string): Promise<boolean> {
    return this.database.withTenant(
      empresaId,
      async tx => {
        const rows = await tx
          .select({ locked: sql<boolean>`${loginAttempts.lockedUntil} is not null and ${loginAttempts.lockedUntil} > now()` })
          .from(loginAttempts)
          .where(eq(loginAttempts.userId, userId))
        return rows[0]?.locked === true
      },
      'read only',
    )
  }

  /**
   * Un intento fallido más. Si la ventana venció, el conteo arranca de nuevo; al llegar a
   * LOGIN_MAX_FAILURES, bloquea LOGIN_LOCK_DURATION y el conteo vuelve a cero.
   */
  async registerLoginFailure(empresaId: string, userId: string): Promise<void> {
    await this.database.withTenant(empresaId, async tx => {
      const expired = sql`${loginAttempts.windowStartedAt} <= now() - ${LOGIN_FAILURE_WINDOW}::interval`
      const next = sql`case when ${expired} then 1 else ${loginAttempts.failedCount} + 1 end`
      await tx
        .insert(loginAttempts)
        .values({ empresaId, userId, failedCount: 1, windowStartedAt: sql`now()` })
        .onConflictDoUpdate({
          target: [loginAttempts.empresaId, loginAttempts.userId],
          set: {
            failedCount: sql`case when ${next} >= ${LOGIN_MAX_FAILURES} then 0 else ${next} end`,
            windowStartedAt: sql`case when ${expired} then now() else ${loginAttempts.windowStartedAt} end`,
            lockedUntil: sql`case when ${next} >= ${LOGIN_MAX_FAILURES} then now() + ${LOGIN_LOCK_DURATION}::interval else ${loginAttempts.lockedUntil} end`,
          },
        })
    })
  }

  /** Login exitoso: borra el conteo de fallos. */
  async clearLoginFailures(empresaId: string, userId: string): Promise<void> {
    await this.database.withTenant(empresaId, tx => tx.delete(loginAttempts).where(eq(loginAttempts.userId, userId)))
  }

  /** Emite el primer refresh token de una familia nueva (un login). Devuelve el id de la familia. */
  async startRefreshFamily(empresaId: string, userId: string, tokenHash: string): Promise<string> {
    const familyId = newId()
    await this.database.withTenant(empresaId, tx => insertRefreshToken(tx, { empresaId, userId, familyId, tokenHash }))
    return familyId
  }

  /**
   * Rota un refresh token (ADR-BE-003, sub-decisión 3). Con el tenant de la fila:
   * - si estaba vigente (sin usar, sin revocar, sin vencer) y el usuario sigue activo, lo marca usado
   *   y emite `newTokenHash` en la misma familia;
   * - si ya estaba usado, es un reuso: revoca la familia entera (también el último emitido);
   * - si no, es inválido.
   * La revocación se confirma aunque el request termine en 401.
   */
  async rotateRefreshToken(oldTokenHash: string, newTokenHash: string): Promise<RotationResult> {
    const found = await this.database.findRefreshToken(oldTokenHash)
    if (found === null) return { kind: 'invalid' }
    return this.database.withTenant(found.empresaId, async tx => {
      const used = await tx
        .update(refreshTokens)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(refreshTokens.id, found.id),
            isNull(refreshTokens.usedAt),
            isNull(refreshTokens.revokedAt),
            sql`${refreshTokens.expiresAt} > now()`,
          ),
        )
        .returning({ id: refreshTokens.id })
      if (used.length === 0) {
        const rows = await tx.select({ usedAt: refreshTokens.usedAt }).from(refreshTokens).where(eq(refreshTokens.id, found.id))
        if (rows[0]?.usedAt !== null && rows[0]?.usedAt !== undefined) {
          await revokeFamily(tx, found.familyId)
          return { kind: 'reused' }
        }
        return { kind: 'invalid' }
      }
      const user = await tx.select({ active: users.active }).from(users).where(eq(users.id, found.userId))
      if (user[0]?.active !== true) {
        await revokeFamily(tx, found.familyId)
        return { kind: 'invalid' }
      }
      await insertRefreshToken(tx, { empresaId: found.empresaId, userId: found.userId, familyId: found.familyId, tokenHash: newTokenHash })
      return { kind: 'rotated', empresaId: found.empresaId, userId: found.userId, familyId: found.familyId }
    })
  }

  /** Logout por cookie: revoca la familia del token presentado, si existe. */
  async revokeFamilyOfToken(tokenHash: string): Promise<void> {
    const found = await this.database.findRefreshToken(tokenHash)
    if (found === null) return
    await this.database.withTenant(found.empresaId, tx => revokeFamily(tx, found.familyId))
  }

  /** Logout por access token: revoca la familia `familyId` del usuario (el claim `sid`). */
  async revokeFamilyOfUser(empresaId: string, userId: string, familyId: string): Promise<void> {
    await this.database.withTenant(empresaId, tx =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(refreshTokens.familyId, familyId), eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))),
    )
  }

  /**
   * Usuario, rol, permisos y sucursales habilitadas, en una sola consulta con el tenant del token.
   * Con otro tenant (un `emp` que no es el del usuario), RLS no deja ver la fila: `null`.
   */
  async loadPrincipal(empresaId: string, userId: string): Promise<Principal | null> {
    const rows = await this.database.withTenant(
      empresaId,
      tx =>
        tx.execute(sql`
          select u.id, u.role_id, u.active, u.permissions_version,
                 coalesce((select json_agg(json_build_object('module', p.module, 'action', p.action))
                             from ${rolePermissions} p where p.role_id = u.role_id), '[]'::json) as permissions,
                 coalesce((select json_agg(b.branch_id) from ${userBranches} b where b.user_id = u.id), '[]'::json) as branch_ids
            from ${users} u
           where u.id = ${userId}`),
      'read only',
    )
    if (rows.rows.length === 0) return null
    const row = principalRowSchema.parse(rows.rows[0])
    return {
      userId: row.id,
      empresaId,
      roleId: row.role_id,
      active: row.active,
      permissionsVersion: row.permissions_version,
      permissions: new Set(row.permissions.map(p => permissionKey(p.module, p.action))),
      branchIds: new Set(row.branch_ids),
    }
  }

  /** Datos de GET /auth/session. */
  async loadSession(empresaId: string, userId: string): Promise<SessionData | null> {
    return this.database.withTenant(
      empresaId,
      async tx => {
        const [row] = await tx
          .select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            roleId: roles.id,
            roleName: roles.name,
            companyId: companies.id,
            companyName: companies.name,
            timezone: companies.timezone,
          })
          .from(users)
          .innerJoin(roles, eq(roles.id, users.roleId))
          .innerJoin(companies, eq(companies.id, users.empresaId))
          .where(eq(users.id, userId))
        if (row === undefined) return null
        const permissions = await tx
          .select({ module: rolePermissions.module, action: rolePermissions.action })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, row.roleId))
          .orderBy(asc(rolePermissions.module), asc(rolePermissions.action))
        const enabled = tx.select({ id: userBranches.branchId }).from(userBranches).where(eq(userBranches.userId, userId))
        const branchRows = await tx
          .select({
            id: branches.id,
            name: branches.name,
            code: branches.code,
            city: branches.city,
            address: branches.address,
            status: branches.status,
          })
          .from(branches)
          .where(inArray(branches.id, enabled))
          .orderBy(asc(branches.code))
        return {
          user: { id: row.id, email: row.email, fullName: row.fullName },
          company: { id: row.companyId, name: row.companyName, timezone: row.timezone },
          role: { id: row.roleId, name: row.roleName },
          permissions,
          branches: branchRows,
        }
      },
      'read only',
    )
  }
}

