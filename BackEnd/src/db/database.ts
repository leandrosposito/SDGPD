import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import { idSchema } from '@sdgpd/contracts'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { APP_CONFIG, type AppConfig } from '../config/config.ts'
import * as schema from './schema/index.ts'

type Db = NodePgDatabase<typeof schema>
/** Transacción con el tenant ya fijado. Es lo único que recibe el código de negocio. */
export type TenantTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Acceso a Postgres. El cliente Drizzle es privado: la única forma de tocar tablas de negocio es
 * withTenant (ADR-BE-002). El schema lo decide el rol de la conexión (search_path por rol,
 * ADR-BE-002 sub-decisión 8): este código no nombra ningún schema.
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
  async withTenant<T>(empresaId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    const id = idSchema.parse(empresaId)
    return this.db.transaction(async tx => {
      await tx.execute(sql`select set_config('app.empresa_id', ${id}, true)`)
      return fn(tx)
    })
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
