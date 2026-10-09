import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import { idSchema } from '@sdgpd/contracts'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { z } from 'zod'
import { APP_CONFIG, type AppConfig } from '../config/config.ts'
import type { Actor } from '../context/actor.ts'
import { CommandTx } from './command.ts'
import { claimKey, completeKey, type IdempotencyRequest, type StoredResponse } from './idempotency.ts'
import * as schema from './schema/index.ts'
import type { Db, TenantTx } from './tenant-tx.ts'

export type { TenantTx } from './tenant-tx.ts'

const loginUserRowSchema = z
  .object({ id: z.uuid(), empresa_id: z.uuid(), password_hash: z.string(), active: z.boolean() })
  .strict()
  .transform(r => ({ id: r.id, empresaId: r.empresa_id, passwordHash: r.password_hash, active: r.active }))
/** Lo que devuelve `auth_find_user`: nada más. */
export type LoginUserRow = z.output<typeof loginUserRowSchema>

const refreshTokenRowSchema = z
  .object({ id: z.uuid(), empresa_id: z.uuid(), user_id: z.uuid(), family_id: z.uuid() })
  .strict()
  .transform(r => ({ id: r.id, empresaId: r.empresa_id, userId: r.user_id, familyId: r.family_id }))
/** Lo que devuelve `auth_find_refresh_token`: nada más. */
export type RefreshTokenRow = z.output<typeof refreshTokenRowSchema>

/** Lo que recibe una lectura: solo `select`, dentro de una transacción READ ONLY con el tenant fijado. */
export type ReadTx = { readonly select: TenantTx['select'] }

/**
 * Acceso a Postgres. El cliente Drizzle es privado. El código de negocio entra por:
 * - `read(empresaId, fn)`: lecturas, en una transacción READ ONLY (Postgres rechaza cualquier escritura);
 * - `command(actor, fn)` / `idempotentCommand(...)`: comandos, con un CommandTx cuyas escrituras
 *   siempre se auditan (ADR-BE-005).
 * `withTenant` (transacción cruda) queda para src/db/ y los tests: ESLint prohíbe usarlo en el resto
 * de src/. El schema lo decide el rol de la conexión (ADR-BE-002, sub-decisión 8).
 */
@Injectable()
export class Database implements OnModuleDestroy {
  private readonly pool: pg.Pool
  private readonly db: Db

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.database.url,
      ssl: { ca: config.database.caCert, rejectUnauthorized: true },
      max: config.database.maxConnections,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
      application_name: 'sdgpd-backend',
    })
    this.db = drizzle(this.pool, { schema })
  }

  /**
   * Abre una transacción, fija el tenant con set_config(..., true) —local a la transacción,
   * nunca a la conexión— y ejecuta fn. Sin tenant fijado, toda tabla con RLS devuelve cero filas.
   */
  async withTenant<T>(
    empresaId: string,
    fn: (tx: TenantTx) => Promise<T>,
    accessMode: 'read write' | 'read only' = 'read write',
  ): Promise<T> {
    const id = idSchema.parse(empresaId)
    return this.db.transaction(
      async tx => {
        await tx.execute(sql`select set_config('app.empresa_id', ${id}, true)`)
        return fn(tx)
      },
      { accessMode },
    )
  }

  /** Lectura con el tenant de la empresa, en una transacción READ ONLY. */
  async read<T>(empresaId: string, fn: (tx: ReadTx) => Promise<T>): Promise<T> {
    return this.withTenant(empresaId, tx => fn({ select: tx.select.bind(tx) }), 'read only')
  }

  /** Comando: una transacción con el tenant del actor (ADR-BE-005 › Transacciones). */
  async command<T>(actor: Actor, fn: (tx: CommandTx) => Promise<T>): Promise<T> {
    return this.withTenant(actor.empresaId, tx => fn(new CommandTx(tx, actor)))
  }

  /**
   * Comando idempotente (ADR-BE-005 › Idempotencia): la clave se registra en la MISMA transacción.
   * Si el comando falla, no queda nada y un reintento se ejecuta de nuevo. Misma clave y mismo payload:
   * replay de la respuesta guardada. Misma clave y otro payload: 422 `idempotency-key-reused`.
   */
  async idempotentCommand(
    actor: Actor,
    request: IdempotencyRequest,
    fn: (tx: CommandTx) => Promise<StoredResponse>,
  ): Promise<{ replayed: boolean; response: StoredResponse }> {
    return this.withTenant(actor.empresaId, async tx => {
      const claim = await claimKey(tx, actor, request)
      if (!claim.claimed) return { replayed: true, response: claim.stored }
      const response = await fn(new CommandTx(tx, actor))
      await completeKey(tx, actor, request, response)
      return { replayed: false, response }
    })
  }

  /**
   * Borra las claves de idempotencia vencidas de TODAS las empresas (ADR-BE-005, sub-decisión 8).
   * Corre sin tenant: la política `expired_cleanup` (migración 0003) solo deja borrar las vencidas,
   * y el DELETE no tiene WHERE ni RETURNING, así que no lee ninguna fila. Con un advisory lock de
   * transacción por schema, corre en una sola instancia a la vez. Devuelve cuántas borró, o `null`
   * si otra instancia tenía el lock.
   */
  async cleanupExpiredIdempotencyKeys(): Promise<number | null> {
    return this.db.transaction(async tx => {
      const lock = await tx.execute<{ locked: boolean; tenant: string | null }>(
        sql`select pg_try_advisory_xact_lock(hashtext(current_schema() || ':idempotency-cleanup')) as locked,
                   nullif(current_setting('app.empresa_id', true), '') as tenant`,
      )
      const row = lock.rows[0]
      if (row?.tenant !== null) throw new Error('la limpieza de idempotencia no corre con un tenant fijado')
      if (!row.locked) return null
      const deleted = await tx.execute(sql`delete from ${schema.idempotencyKeys}`)
      return deleted.rowCount ?? 0
    })
  }

  /**
   * Borra los refresh tokens vencidos de TODAS las empresas (BE-1b). Igual que la limpieza de
   * idempotencia: sin tenant, la política `expired_cleanup` (migración 0006) solo deja borrar los
   * vencidos, el DELETE no lee filas, y un advisory lock propio por schema hace que corra en una sola
   * instancia. Devuelve cuántos borró, o `null` si otra instancia tenía el lock.
   */
  async cleanupExpiredRefreshTokens(): Promise<number | null> {
    return this.db.transaction(async tx => {
      const lock = await tx.execute<{ locked: boolean; tenant: string | null }>(
        sql`select pg_try_advisory_xact_lock(hashtext(current_schema() || ':refresh-tokens-cleanup')) as locked,
                   nullif(current_setting('app.empresa_id', true), '') as tenant`,
      )
      const row = lock.rows[0]
      if (row?.tenant !== null) throw new Error('la limpieza de refresh tokens no corre con un tenant fijado')
      if (!row.locked) return null
      const deleted = await tx.execute(sql`delete from ${schema.refreshTokens}`)
      return deleted.rowCount ?? 0
    })
  }

  /**
   * Login sin tenant (ADR-BE-002, sub-decisión 2): la función SECURITY DEFINER `auth_find_user`, que
   * devuelve solo id, empresa, hash y activo. Junto con `findRefreshToken`, es la ÚNICA lectura de
   * users o refresh_tokens sin tenant; cualquier otra consulta sin tenant ve cero filas (RLS).
   */
  async findLoginUser(email: string): Promise<LoginUserRow | null> {
    const result = await this.pool.query('select * from auth_find_user($1)', [email])
    return result.rows.length === 0 ? null : loginUserRowSchema.parse(result.rows[0])
  }

  /** Refresh sin tenant: la función SECURITY DEFINER `auth_find_refresh_token` (id, empresa, usuario, familia). */
  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
    const result = await this.pool.query('select * from auth_find_refresh_token($1)', [tokenHash])
    return result.rows.length === 0 ? null : refreshTokenRowSchema.parse(result.rows[0])
  }

  /** Verifica que la base contesta. No toca tablas. */
  async ping(): Promise<void> {
    await this.pool.query('select 1')
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async onModuleDestroy(): Promise<void> {
    await this.close()
  }
}
