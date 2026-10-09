// Utilidades de los scripts de base (setup, migrate, sql). Corren con Node 24 sin compilar
// (type stripping): solo sintaxis TypeScript borrable. Nunca imprimen contraseñas ni URLs.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'

export const SCHEMAS = { dev: 'sdgpd', test: 'sdgpd_test' } as const
export type SchemaName = (typeof SCHEMAS)[keyof typeof SCHEMAS]
export const SCHEMA_NAMES: readonly SchemaName[] = Object.values(SCHEMAS)

export function isSchemaName(value: string): value is SchemaName {
  return SCHEMA_NAMES.some(s => s === value)
}

/** Roles propios (ADR-BE-002, sub-decisión 6) y la variable de .env con la URL de cada uno. */
export const ROLES = {
  migrator: { name: 'sdgpd_migrator', urlVar: 'DATABASE_URL_MIGRATOR' },
  app: { name: 'sdgpd_app', urlVar: 'DATABASE_URL' },
  app_test: { name: 'sdgpd_app_test', urlVar: 'DATABASE_URL_TEST' },
} as const
export type RoleKey = keyof typeof ROLES
export const ROLE_KEYS: readonly RoleKey[] = ['migrator', 'app', 'app_test']

export function isRoleKey(value: string): value is RoleKey {
  return ROLE_KEYS.some(k => k === value)
}

/** Schema al que está atado cada rol de aplicación (search_path por rol, ADR-BE-002 sub-decisión 8). */
export const APP_ROLE_SCHEMA = { app: SCHEMAS.dev, app_test: SCHEMAS.test } as const
/** Rol de aplicación de cada schema (la inversa de APP_ROLE_SCHEMA). */
export const SCHEMA_APP_ROLE: Record<SchemaName, string> = { sdgpd: 'sdgpd_app', sdgpd_test: 'sdgpd_app_test' }

/**
 * Tablas append-only (ADR-BE-005 › Auditoría): el rol de aplicación tiene solo SELECT e INSERT.
 * Los default privileges conceden también UPDATE y DELETE a toda tabla nueva, y las migraciones no
 * pueden nombrar roles, así que la revocación la aplican setup.ts y migrate.ts después de cada corrida.
 */
export const APPEND_ONLY_TABLES = ['audit_log'] as const

export async function enforceAppendOnly(client: pg.Client, schema: SchemaName): Promise<void> {
  const role = client.escapeIdentifier(SCHEMA_APP_ROLE[schema])
  for (const table of APPEND_ONLY_TABLES) {
    const qualified = `${client.escapeIdentifier(schema)}.${client.escapeIdentifier(table)}`
    const exists = await client.query<{ t: string | null }>('select to_regclass($1)::text as t', [qualified])
    if (exists.rows[0]?.t !== null) await client.query(`revoke update, delete, truncate on ${qualified} from ${role}`)
  }
}

/**
 * Funciones SECURITY DEFINER (ADR-BE-002, sub-decisión 2; BE-1a): login y refresh antes de conocer el
 * tenant. Las crea una migración, que no puede nombrar schemas ni roles; por eso su search_path fijo
 * (`<schema>, pg_temp`: pg_temp al final, para que una tabla temporal no pueda suplantar a una real) y
 * su EXECUTE (solo el rol de aplicación de ese schema, nunca PUBLIC) los aplican setup.ts y migrate.ts,
 * en la misma transacción que las migraciones. El dueño es el migrador, que es quien las crea.
 */
export const DEFINER_FUNCTIONS = ['auth_find_user(text)', 'auth_find_refresh_token(text)'] as const

export async function hardenDefinerFunctions(client: pg.Client, schema: SchemaName): Promise<void> {
  const role = client.escapeIdentifier(SCHEMA_APP_ROLE[schema])
  const qualifiedSchema = client.escapeIdentifier(schema)
  for (const signature of DEFINER_FUNCTIONS) {
    const exists = await client.query<{ f: string | null }>('select to_regprocedure($1)::text as f', [`${schema}.${signature}`])
    if (exists.rows[0]?.f === null) continue
    const open = signature.indexOf('(')
    const fn = `${qualifiedSchema}.${client.escapeIdentifier(signature.slice(0, open))}${signature.slice(open)}`
    await client.query(`alter function ${fn} set search_path = ${qualifiedSchema}, pg_temp`)
    await client.query(`revoke all on function ${fn} from public`)
    await client.query(`grant execute on function ${fn} to ${role}`)
  }
}

export const ENV_FILE = '.env'

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Falta la variable de entorno ${name} (ver BackEnd/docs/SETUP_SUPABASE.md)`)
  }
  return value
}

/** SSL siempre verificado contra la CA de DATABASE_CA_CERT. Nunca rejectUnauthorized: false. */
export function sslOptions(): { ca: string; rejectUnauthorized: true } {
  const path = requireEnv('DATABASE_CA_CERT')
  if (!existsSync(path)) throw new Error('DATABASE_CA_CERT apunta a un archivo que no existe')
  return { ca: readFileSync(path, 'utf8'), rejectUnauthorized: true }
}

/**
 * Usuario de conexión de un rol. Con el pooler de Supabase es `<rol>.<ref>`; sin
 * SUPABASE_PROJECT_REF (Postgres propio o host directo), el nombre del rol.
 */
export function connectionUser(role: string): string {
  const ref = process.env.SUPABASE_PROJECT_REF
  return ref ? `${role}.${ref}` : role
}

export function databaseUrl(role: string, password: string): string {
  const url = new URL('postgresql://localhost')
  url.hostname = requireEnv('DB_HOST')
  url.port = process.env.DB_PORT ?? '5432'
  url.pathname = `/${process.env.DB_NAME ?? 'postgres'}`
  url.username = connectionUser(role)
  url.password = password
  return url.toString()
}

export async function connectUrl(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url, ssl: sslOptions(), connectionTimeoutMillis: 20_000 })
  await client.connect()
  return client
}

/** Conexión de administración (`postgres`), con la contraseña de SUPABASE_DB_PASSWORD. */
export async function connectAdmin(): Promise<pg.Client> {
  const admin = process.env.DB_ADMIN_USER ?? 'postgres'
  return connectUrl(databaseUrl(admin, requireEnv('SUPABASE_DB_PASSWORD')))
}

export async function connectAs(role: RoleKey): Promise<pg.Client> {
  return connectUrl(requireEnv(ROLES[role].urlVar))
}

/** Lee .env como pares clave/valor, conservando el orden de las líneas. */
export function readEnvFile(): string[] {
  return existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split(/\r?\n/) : []
}

export function envValue(lines: string[], key: string): string | undefined {
  const line = lines.find(l => l.startsWith(`${key}=`))
  return line === undefined ? undefined : line.slice(key.length + 1)
}

/** Reemplaza (o agrega) claves en .env sin tocar el resto de las líneas. */
export function writeEnvValues(values: Record<string, string>): void {
  const lines = readEnvFile()
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex(l => l.startsWith(`${key}=`))
    if (index >= 0) lines[index] = `${key}=${value}`
    else lines.splice(lines.at(-1) === '' ? lines.length - 1 : lines.length, 0, `${key}=${value}`)
  }
  if (lines.at(-1) !== '') lines.push('')
  writeFileSync(ENV_FILE, lines.join('\n'))
}

/** Bytes de cada clave del servidor: 256 bits. */
export const APP_SECRET_BYTES = 32

/**
 * Claves del servidor que viven solo en .env (nunca se imprimen ni se versionan): la del access token
 * (ADR-BE-003, sub-decisión 2; BE-1a) y la del HMAC del payload de idempotencia (ADR-BE-005; BE-1b).
 */
export const APP_SECRETS = ['JWT_SECRET', 'IDEMPOTENCY_HMAC_KEY'] as const

/**
 * Genera en .env las claves de APP_SECRETS que faltan o tienen menos de 32 bytes (aleatorias, en
 * base64url). Las que ya están no se tocan. Devuelve los nombres de las que generó.
 */
export function ensureAppSecrets(): string[] {
  const lines = readEnvFile()
  const missing: Record<string, string> = {}
  for (const name of APP_SECRETS) {
    const current = envValue(lines, name)
    if (current === undefined || Buffer.from(current, 'base64url').length < APP_SECRET_BYTES) {
      missing[name] = randomBytes(APP_SECRET_BYTES).toString('base64url')
    }
  }
  if (Object.keys(missing).length > 0) writeEnvValues(missing)
  return Object.keys(missing)
}

/** Mensaje de un error de Postgres sin datos de conexión. */
export function pgErrorText(err: unknown): string {
  if (err instanceof Error) {
    const code = 'code' in err && typeof err.code === 'string' ? `${err.code} ` : ''
    return `${code}${err.message}`
  }
  return String(err)
}
