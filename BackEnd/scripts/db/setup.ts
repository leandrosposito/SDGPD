// Setup de roles y schemas (ADR-BE-002). Idempotente: se puede correr las veces que haga falta.
// Corre como `postgres` (SUPABASE_DB_PASSWORD) y deja:
//   - sdgpd_migrator: dueño de los schemas sdgpd y sdgpd_test y de sus tablas.
//   - sdgpd_app: sin BYPASSRLS, sin ser dueño de nada; USAGE solo en sdgpd y DML solo en sus tablas.
//   - sdgpd_app_test: igual, pero solo sobre sdgpd_test.
//   - los dos schemas sin privilegios para PUBLIC, anon, authenticated ni service_role.
// Las contraseñas se generan acá (o se reusan las de BackEnd/.env) y se guardan SOLO en .env.
// Al servidor viaja el verificador SCRAM, nunca la contraseña en claro (no queda en ningún log).
// Uso: npm run db:setup -w @sdgpd/backend
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto'
import type pg from 'pg'
import {
  APP_ROLE_SCHEMA,
  connectAdmin,
  connectUrl,
  connectionUser,
  databaseUrl,
  envValue,
  pgErrorText,
  readEnvFile,
  ROLE_KEYS,
  ROLES,
  type RoleKey,
  SCHEMAS,
  writeEnvValues,
} from './lib.ts'

/** Roles de Supabase que no pueden tener ningún privilegio sobre nuestros schemas. */
const FOREIGN_ROLES = ['anon', 'authenticated', 'service_role']
const SCRAM_ITERATIONS = 4096

function scramVerifier(password: string): string {
  const salt = randomBytes(16)
  const salted = pbkdf2Sync(password, salt, SCRAM_ITERATIONS, 32, 'sha256')
  const clientKey = createHmac('sha256', salted).update('Client Key').digest()
  const storedKey = createHash('sha256').update(clientKey).digest()
  const serverKey = createHmac('sha256', salted).update('Server Key').digest()
  return `SCRAM-SHA-256$${SCRAM_ITERATIONS}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`
}

/** Reusa la contraseña de .env si la URL es de ese rol; si no, genera una nueva. */
function passwordFor(role: RoleKey, envLines: string[]): string {
  const current = envValue(envLines, ROLES[role].urlVar)
  if (current !== undefined) {
    const url = new URL(current)
    if (decodeURIComponent(url.username) === connectionUser(ROLES[role].name) && url.password !== '') {
      return decodeURIComponent(url.password)
    }
  }
  return randomBytes(32).toString('base64url')
}

async function main(): Promise<void> {
  const envLines = readEnvFile()
  const roleKeys = ROLE_KEYS
  const passwords: Record<RoleKey, string> = {
    migrator: passwordFor('migrator', envLines),
    app: passwordFor('app', envLines),
    app_test: passwordFor('app_test', envLines),
  }

  // Si la contraseña de .env ya conecta, no se vuelve a mandar el verificador: cada envío lleva una
  // sal nueva, y el pooler de Supabase tiene cacheado el anterior, así que fallaría hasta refrescarlo.
  const working = new Set<RoleKey>()
  for (const key of roleKeys) {
    const client = await connectUrl(databaseUrl(ROLES[key].name, passwords[key])).catch(() => undefined)
    if (client !== undefined) {
      working.add(key)
      await client.end()
    }
  }

  const admin = await connectAdmin()
  const id = (name: string): string => admin.escapeIdentifier(name)
  const migrator = id(ROLES.migrator.name)
  try {
    const existingForeign = (
      await admin.query<{ rolname: string }>('select rolname from pg_roles where rolname = any($1)', [FOREIGN_ROLES])
    ).rows.map(r => r.rolname)
    const revokeFrom = ['PUBLIC', ...existingForeign.map(id)].join(', ')

    await admin.query('begin')

    // 1. Roles. ALTER no toca SUPERUSER/BYPASSRLS/REPLICATION (solo un superusuario puede); se verifican abajo.
    for (const key of roleKeys) {
      const role = ROLES[key].name
      const exists = (await admin.query('select 1 from pg_roles where rolname = $1', [role])).rowCount === 1
      const password = working.has(key) ? '' : ` password ${admin.escapeLiteral(scramVerifier(passwords[key]))}`
      await admin.query(
        exists
          ? `alter role ${id(role)} with login nocreatedb nocreaterole noinherit${password}`
          : `create role ${id(role)} with login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls${password}`,
      )
    }

    // 2. Para poner al migrador como dueño y fijar sus default privileges, postgres necesita
    //    ser miembro del migrador mientras dura el setup. Se revoca al final.
    await admin.query(`grant ${migrator} to current_user`)

    // 3. Schemas: dueño el migrador, nada para PUBLIC ni para los roles de Supabase.
    for (const schema of Object.values(SCHEMAS)) {
      await admin.query(`create schema if not exists ${id(schema)} authorization ${migrator}`)
      await admin.query(`alter schema ${id(schema)} owner to ${migrator}`)
      await admin.query(`revoke all on schema ${id(schema)} from ${revokeFrom}`)
    }

    // 4. Cada rol de aplicación ve solo su schema.
    for (const key of ['app', 'app_test'] as const) {
      const role = id(ROLES[key].name)
      for (const schema of Object.values(SCHEMAS)) {
        if (schema === APP_ROLE_SCHEMA[key]) await admin.query(`grant usage on schema ${id(schema)} to ${role}`)
        else await admin.query(`revoke all on schema ${id(schema)} from ${role}`)
      }
    }

    // 5. Como migrador: tabla de control, default privileges y privilegios de las tablas existentes.
    //    La tabla de control se crea antes que los default privileges, y además se revoca explícitamente.
    await admin.query(`set local role ${migrator}`)
    for (const key of ['app', 'app_test'] as const) {
      const schema = id(APP_ROLE_SCHEMA[key])
      const role = id(ROLES[key].name)
      await admin.query(
        `create table if not exists ${schema}.schema_migrations (
           tag text primary key,
           hash text not null,
           applied_at timestamptz not null default now()
         )`,
      )
      await admin.query(
        `alter default privileges for role ${migrator} in schema ${schema} grant select, insert, update, delete on tables to ${role}`,
      )
      await admin.query(
        `alter default privileges for role ${migrator} in schema ${schema} revoke execute on functions from public`,
      )
      await admin.query(`grant select, insert, update, delete on all tables in schema ${schema} to ${role}`)
      await admin.query(`revoke all on all tables in schema ${schema} from ${revokeFrom}`)
      await admin.query(`revoke all on ${schema}.schema_migrations from ${role}`)
    }
    await admin.query('reset role')

    // 6. search_path atado al rol: la aplicación no nombra el schema. El migrador no tiene schema
    //    por defecto: una migración sin search_path explícito falla en vez de caer en otro schema.
    for (const key of ['app', 'app_test'] as const) {
      await admin.query(`alter role ${id(ROLES[key].name)} set search_path to ${id(APP_ROLE_SCHEMA[key])}`)
    }
    await admin.query(`alter role ${migrator} set search_path to pg_catalog`)

    await admin.query(`revoke ${migrator} from current_user`)
    await admin.query('commit')
  } catch (err) {
    await admin.query('rollback').catch(() => undefined)
    throw err
  } finally {
    await admin.end()
  }

  // 7. URLs en .env (solo ahí) y verificación de que los tres roles se conectan.
  const urlOf = (k: RoleKey): string => databaseUrl(ROLES[k].name, passwords[k])
  const urls: Record<RoleKey, string> = { migrator: urlOf('migrator'), app: urlOf('app'), app_test: urlOf('app_test') }
  writeEnvValues(Object.fromEntries(roleKeys.map(k => [ROLES[k].urlVar, urls[k]])))
  for (const key of roleKeys) {
    let client: pg.Client | undefined
    try {
      client = await connectUrl(urls[key])
      const { rows } = await client.query<{ user: string; schema: string | null; bypass: boolean; superuser: boolean }>(
        `select current_user as "user", current_schema() as schema, rolbypassrls as bypass, rolsuper as superuser
           from pg_roles where rolname = current_user`,
      )
      const row = rows[0]
      if (row === undefined || row.user !== ROLES[key].name || row.bypass || row.superuser) {
        throw new Error(`el rol ${ROLES[key].name} no quedó como se esperaba: ${JSON.stringify(row)}`)
      }
      console.log(`ok  ${row.user.padEnd(16)} conecta; schema por defecto: ${row.schema ?? '(ninguno)'}; bypassrls: ${row.bypass}`)
    } catch (err) {
      console.error(`FALLA ${ROLES[key].name}: ${pgErrorText(err)}`)
      process.exitCode = 1
    } finally {
      await client?.end()
    }
  }
}

main().catch((err: unknown) => {
  console.error(`setup falló: ${pgErrorText(err)}`)
  process.exit(1)
})
