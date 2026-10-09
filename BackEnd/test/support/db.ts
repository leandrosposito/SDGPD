import pg from 'pg'
import { type AppConfig, loadConfig } from '../../src/config/config.ts'

/** Los tests corren SOLO como este rol y sobre este schema (guard: test/setup/guard.ts). */
export const TEST_ROLE = 'sdgpd_app_test'
export const TEST_SCHEMA = 'sdgpd_test'
/** El schema de desarrollo, que los tests solo miran en el catálogo (nunca escriben ahí). */
export const DEV_SCHEMA = 'sdgpd'
export const DEV_ROLE = 'sdgpd_app'

/** Config de la aplicación apuntada a la base de tests, con un pool chico: la base es remota. */
export function testConfig(maxConnections = 2): AppConfig {
  const config = loadConfig({
    PORT: '3000',
    DATABASE_URL: process.env.DATABASE_URL_TEST,
    DATABASE_CA_CERT: process.env.DATABASE_CA_CERT,
    JWT_SECRET: process.env.JWT_SECRET,
    IDEMPOTENCY_HMAC_KEY: process.env.IDEMPOTENCY_HMAC_KEY,
  })
  return { ...config, database: { ...config.database, maxConnections } }
}

/** Conexión directa como sdgpd_app_test, SIN tenant: para el catálogo y los casos "sin tenant". */
export async function rawTestClient(): Promise<pg.Client> {
  const { database } = testConfig()
  const client = new pg.Client({
    connectionString: database.url,
    ssl: { ca: database.caCert, rejectUnauthorized: true },
    connectionTimeoutMillis: 20_000,
  })
  await client.connect()
  return client
}

/** SQLSTATE de un error de Postgres, aunque venga envuelto (Drizzle lo pone en `cause`). */
export function pgCode(err: unknown): string | undefined {
  let current: unknown = err
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    if ('code' in current && typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) {
      return current.code
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}

/** SQLSTATE 42501: insufficient_privilege (incluye "new row violates row-level security policy"). */
export const INSUFFICIENT_PRIVILEGE = '42501'
