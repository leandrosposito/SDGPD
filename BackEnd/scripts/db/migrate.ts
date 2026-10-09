// Aplica las migraciones de drizzle/ (drizzle-kit generate + SQL propio) como sdgpd_migrator.
// Las MISMAS migraciones van a los dos schemas; cada uno lleva su propia tabla de control
// (<schema>.schema_migrations, creada por setup.ts). El schema destino se fija con
// SET LOCAL search_path: las migraciones no nombran ningún schema, y este runner rechaza
// las que lo hagan (drizzle-kit califica las FK con "public": hay que sacarlo a mano).
// `drizzle-kit push` está prohibido (ADR-BE-001 §Decisión 3).
// Uso: npm run db:migrate -w @sdgpd/backend [-- sdgpd | sdgpd_test]
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type pg from 'pg'
import { z } from 'zod'
import {
  connectAs,
  enforceAppendOnly,
  hardenDefinerFunctions,
  isSchemaName,
  pgErrorText,
  SCHEMA_NAMES,
  type SchemaName,
} from './lib.ts'

const MIGRATIONS_DIR = 'drizzle'
const BREAKPOINT = '--> statement-breakpoint'
/** Una migración no puede elegir su schema ni su rol: eso lo decide el runner. */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /"public"\s*\.|\bpublic\s*\./i, reason: 'nombra el schema public' },
  { pattern: /\bsdgpd(_test)?\b/i, reason: 'nombra un schema o rol sdgpd*' },
  { pattern: /\bsearch_path\b/i, reason: 'cambia el search_path' },
  { pattern: /\bset\s+(local\s+)?role\b|\breset\s+role\b/i, reason: 'cambia de rol' },
]

type Migration = { tag: string; hash: string; statements: string[] }
const journalSchema = z.object({ entries: z.array(z.object({ idx: z.int(), tag: z.string().regex(/^[0-9]{4}_[a-z0-9_]+$/) })) })

function loadMigrations(): Migration[] {
  const journal = journalSchema.parse(JSON.parse(readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, 'utf8')))
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map(({ tag }) => {
      // Hash sobre LF: el checkout en Windows trae CRLF y el hash tiene que ser el mismo en todos lados.
      const text = readFileSync(`${MIGRATIONS_DIR}/${tag}.sql`, 'utf8').replace(/\r\n/g, '\n')
      const code = text.replace(/--[^\n]*/g, '')
      for (const { pattern, reason } of FORBIDDEN) {
        if (pattern.test(code)) throw new Error(`la migración ${tag} ${reason}`)
      }
      const statements = text
        .split(BREAKPOINT)
        .map(s => s.trim())
        .filter(s => s.replace(/--[^\n]*/g, '').trim() !== '')
      return { tag, hash: createHash('sha256').update(text).digest('hex'), statements }
    })
}

async function migrateSchema(client: pg.Client, schema: SchemaName, migrations: Migration[]): Promise<void> {
  await client.query('begin')
  try {
    await client.query(`set local search_path to ${client.escapeIdentifier(schema)}`)
    const control = await client.query<{ t: string | null }>(`select to_regclass('schema_migrations')::text as t`)
    if (control.rows[0]?.t === null) throw new Error(`${schema}.schema_migrations no existe: corré db:setup primero`)
    await client.query('lock table schema_migrations in access exclusive mode')
    const applied = new Map(
      (await client.query<{ tag: string; hash: string }>('select tag, hash from schema_migrations')).rows.map(r => [
        r.tag,
        r.hash,
      ]),
    )
    const known = new Set(migrations.map(m => m.tag))
    for (const tag of applied.keys()) {
      if (!known.has(tag)) throw new Error(`${schema}: la migración aplicada ${tag} no está en drizzle/`)
    }
    const done: string[] = []
    for (const m of migrations) {
      const previous = applied.get(m.tag)
      if (previous !== undefined) {
        if (previous !== m.hash) throw new Error(`${schema}: ${m.tag} cambió después de aplicada (hash distinto)`)
        continue
      }
      for (const statement of m.statements) await client.query(statement)
      await client.query('insert into schema_migrations (tag, hash) values ($1, $2)', [m.tag, m.hash])
      done.push(m.tag)
    }
    await enforceAppendOnly(client, schema)
    await hardenDefinerFunctions(client, schema)
    await client.query('commit')
    console.log(`${schema}: ${done.length ? `aplicadas ${done.join(', ')}` : 'sin migraciones pendientes'} (${migrations.length} en total)`)
  } catch (err) {
    await client.query('rollback').catch(() => undefined)
    throw err
  }
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2)
  const targets: SchemaName[] = []
  for (const t of requested.length === 0 ? SCHEMA_NAMES : requested) {
    if (!isSchemaName(t)) throw new Error(`schema desconocido: ${t} (válidos: ${SCHEMA_NAMES.join(', ')})`)
    targets.push(t)
  }
  const migrations = loadMigrations()
  const client = await connectAs('migrator')
  try {
    for (const schema of targets) await migrateSchema(client, schema, migrations)
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error(`migrate falló: ${pgErrorText(err)}`)
  process.exit(1)
})
