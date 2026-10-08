// Suite funcional de aislamiento entre empresas (ADR-BE-002). Dos empresas, A y B, con una fila
// en cada tabla; con el tenant de A, ninguna operación alcanza las filas de B. Cada tabla con RLS
// necesita un caso en ISOLATION_CASES: el primer test compara contra el catálogo y falla si falta alguno.
// Corre como sdgpd_app_test a través de Database.withTenant, el mismo camino que la aplicación.
import { eq, type SQL, sql } from 'drizzle-orm'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Database, type TenantTx } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { auditLog, branches, companies, documentCounters, idempotencyKeys } from '../../src/db/schema/index.ts'
import { INSUFFICIENT_PRIVILEGE, pgCode, rawTestClient, testConfig } from '../support/db.ts'

type Tenant = {
  companyId: string
  branchId: string
  userId: string
  idempotencyKey: string
  auditId: string
  label: string
}

type IsolationCase = {
  /** Columna que lleva el tenant (empresa_id; en companies, el propio id). */
  tenantColumn: string
  /** Condición que identifica LA fila de prueba del tenant en esta tabla. */
  match: (t: Tenant) => SQL
  /** SET que el test intenta aplicar a la fila de B. */
  mutation: SQL
  /** Expresión que se lee (como B) para comprobar que su fila no cambió. */
  probe: SQL
  /** Inserta una fila NUEVA de esta tabla con el empresa_id dado. */
  insertWith: (tx: TenantTx, empresaId: string) => Promise<unknown>
  /** Append-only: el rol no tiene UPDATE ni DELETE, así que esas operaciones fallan por permisos. */
  appendOnly?: true
}

const auditRow = (empresaId: string, id = newId()) => ({
  id,
  empresaId,
  userId: newId(),
  action: 'create' as const,
  entity: 'isolation-probe',
  entityId: newId(),
  before: null,
  after: { probe: true },
  requestId: newId(),
})

const ISOLATION_CASES: Record<string, IsolationCase> = {
  companies: {
    tenantColumn: 'id',
    match: t => sql`id = ${t.companyId}`,
    mutation: sql`name = 'modificada por A'`,
    probe: sql`name`,
    insertWith: (tx, empresaId) =>
      tx.insert(companies).values({ id: empresaId, name: 'intrusa', timezone: 'America/Argentina/Cordoba' }),
  },
  branches: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.branchId}`,
    mutation: sql`name = 'modificada por A'`,
    probe: sql`name`,
    insertWith: (tx, empresaId) =>
      tx.insert(branches).values({
        id: newId(),
        empresaId,
        name: 'intrusa',
        code: `X-${newId().slice(-6)}`,
        city: 'x',
        address: 'x',
      }),
  },
  idempotency_keys: {
    tenantColumn: 'empresa_id',
    match: t => sql`key = ${t.idempotencyKey}`,
    mutation: sql`payload_hash = 'modificada por A'`,
    probe: sql`payload_hash`,
    insertWith: (tx, empresaId) =>
      tx.insert(idempotencyKeys).values({
        empresaId,
        userId: newId(),
        operation: 'POST /intrusa',
        key: newId(),
        payloadHash: 'x',
        expiresAt: sql`now() + interval '1 hour'`,
      }),
  },
  audit_log: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.auditId}`,
    mutation: sql`entity = 'modificada por A'`,
    probe: sql`entity`,
    insertWith: (tx, empresaId) => tx.insert(auditLog).values(auditRow(empresaId)),
    appendOnly: true,
  },
  document_counters: {
    tenantColumn: 'empresa_id',
    match: t => sql`empresa_id = ${t.companyId} and series = 'PED'`,
    mutation: sql`last_value = last_value + 1000`,
    probe: sql`last_value`,
    insertWith: (tx, empresaId) => tx.insert(documentCounters).values({ empresaId, series: 'REM', lastValue: 1 }),
  },
}

const runId = newId()
let db: Database
let raw: pg.Client
let A: Tenant
let B: Tenant

async function createTenant(label: string): Promise<Tenant> {
  const tenant: Tenant = {
    companyId: newId(),
    branchId: newId(),
    userId: newId(),
    idempotencyKey: newId(),
    auditId: newId(),
    label,
  }
  await db.withTenant(tenant.companyId, async tx => {
    await tx
      .insert(companies)
      .values({ id: tenant.companyId, name: `test ${label} ${runId}`, timezone: 'America/Argentina/Cordoba' })
    await tx.insert(branches).values({
      id: tenant.branchId,
      empresaId: tenant.companyId,
      name: `sucursal ${label}`,
      code: `S-${label}`,
      city: 'Córdoba',
      address: 'Calle 1',
    })
    await tx.insert(idempotencyKeys).values({
      empresaId: tenant.companyId,
      userId: tenant.userId,
      operation: 'POST /probe',
      key: tenant.idempotencyKey,
      payloadHash: `hash ${label}`,
      responseStatus: 201,
      responseBody: {},
      expiresAt: sql`now() + interval '1 hour'`,
    })
    await tx.insert(auditLog).values(auditRow(tenant.companyId, tenant.auditId))
    await tx.insert(documentCounters).values({ empresaId: tenant.companyId, series: 'PED', lastValue: 5 })
  })
  return tenant
}

/** Borra la empresa de prueba. audit_log no se puede borrar (append-only): su fila queda, por diseño. */
async function removeTenant(t: Tenant | undefined): Promise<void> {
  if (t === undefined) return
  await db.withTenant(t.companyId, async tx => {
    await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.empresaId, t.companyId))
    await tx.delete(documentCounters).where(eq(documentCounters.empresaId, t.companyId))
    await tx.delete(branches).where(eq(branches.empresaId, t.companyId))
    await tx.delete(companies).where(eq(companies.id, t.companyId))
    // Con FORCE RLS nadie ve todas las filas, ni el dueño: la limpieza se verifica dentro del tenant.
    const left = await tx.execute(
      sql`select (select count(*) from ${branches})::int + (select count(*) from ${companies})::int
                + (select count(*) from ${idempotencyKeys})::int + (select count(*) from ${documentCounters})::int as n`,
    )
    if (left.rows[0]?.n !== 0) throw new Error(`quedaron filas de la empresa de test ${t.label}`)
  })
}

const ident = (name: string) => sql.identifier(name)

beforeAll(async () => {
  db = new Database(testConfig())
  raw = await rawTestClient()
  A = await createTenant('A')
  B = await createTenant('B')
})

afterAll(async () => {
  try {
    await removeTenant(A)
    await removeTenant(B)
  } finally {
    await raw?.end()
    await db?.close()
  }
})

it('toda tabla con RLS del catálogo tiene su caso de aislamiento (y no sobran casos)', async () => {
  const { rows } = await raw.query<{ name: string }>(
    `select c.relname as name from pg_class c
      where c.relnamespace = current_schema()::regnamespace and c.relkind in ('r', 'p') and c.relrowsecurity
      order by 1`,
  )
  expect(rows.map(r => r.name)).toEqual(Object.keys(ISOLATION_CASES).sort())
})

describe.each(Object.entries(ISOLATION_CASES))('%s', (table, c) => {
  const T = ident(table)
  const tenantCol = ident(c.tenantColumn)
  const readAsB = () =>
    db.withTenant(B.companyId, tx => tx.execute(sql`select ${c.probe} as v from ${T} where ${c.match(B)}`))

  it('con el tenant de A ve su fila y ninguna fila de B', async () => {
    const counts = await db.withTenant(A.companyId, async tx => {
      const own = await tx.execute(sql`select count(*)::int as n from ${T} where ${c.match(A)}`)
      const foreign = await tx.execute(sql`select count(*)::int as n from ${T} where ${c.match(B)}`)
      const others = await tx.execute(sql`select count(*)::int as n from ${T} where ${tenantCol} <> ${A.companyId}`)
      return { own: own.rows[0]?.n, foreign: foreign.rows[0]?.n, others: others.rows[0]?.n }
    })
    expect(counts).toEqual({ own: 1, foreign: 0, others: 0 })
  })

  it(c.appendOnly ? 'nadie la modifica: UPDATE falla por permisos' : 'con el tenant de A no modifica filas de B', async () => {
    const before = await readAsB()
    const attempt = db.withTenant(A.companyId, tx => tx.execute(sql`update ${T} set ${c.mutation} where ${c.match(B)}`))
    if (c.appendOnly) expect(pgCode(await attempt.catch((e: unknown) => e))).toBe(INSUFFICIENT_PRIVILEGE)
    else expect((await attempt).rowCount).toBe(0)
    const after = await readAsB()
    expect(after.rows).toHaveLength(1)
    expect(after.rows).toEqual(before.rows)
  })

  it(c.appendOnly ? 'nadie la borra: DELETE falla por permisos' : 'con el tenant de A no borra filas de B', async () => {
    const attempt = db.withTenant(A.companyId, tx => tx.execute(sql`delete from ${T} where ${c.match(B)}`))
    if (c.appendOnly) expect(pgCode(await attempt.catch((e: unknown) => e))).toBe(INSUFFICIENT_PRIVILEGE)
    else expect((await attempt).rowCount).toBe(0)
    expect((await readAsB()).rows).toHaveLength(1)
  })

  it('con el tenant de A no inserta una fila con el empresa_id de B', async () => {
    const error = await db.withTenant(A.companyId, tx => c.insertWith(tx, B.companyId)).catch((e: unknown) => e)
    expect(pgCode(error)).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('con el tenant de A no pasa una fila propia a B', async () => {
    const error = await db
      .withTenant(A.companyId, tx =>
        tx.execute(sql`update ${T} set ${tenantCol} = ${B.companyId} where ${c.match(A)}`),
      )
      .catch((e: unknown) => e)
    expect(pgCode(error)).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('sin tenant ve cero filas (aunque las de A y B existen)', async () => {
    const { rows } = await raw.query<{ n: number }>(`select count(*)::int as n from ${raw.escapeIdentifier(table)}`)
    expect(rows[0]?.n).toBe(0)
  })
})

describe('withTenant', () => {
  it('el tenant es local a la transacción: al cerrarla, la misma conexión deja de ver filas', async () => {
    await raw.query('begin')
    await raw.query(`select set_config('app.empresa_id', $1, true)`, [A.companyId])
    const inside = await raw.query<{ n: number }>('select count(*)::int as n from companies')
    await raw.query('commit')
    const after = await raw.query<{ n: number; setting: string | null }>(
      `select count(*)::int as n, current_setting('app.empresa_id', true) as setting from companies`,
    )
    expect(inside.rows[0]?.n).toBe(1)
    expect(after.rows[0]).toEqual({ n: 0, setting: '' })
  })

  it('si fn falla, la transacción se revierte entera', async () => {
    const branchId = newId()
    const failure = new Error('falla a propósito')
    await expect(
      db.withTenant(A.companyId, async tx => {
        await ISOLATION_CASES.branches?.insertWith(tx, A.companyId)
        await tx
          .insert(branches)
          .values({ id: branchId, empresaId: A.companyId, name: 'x', code: `R-${runId}`, city: 'x', address: 'x' })
        throw failure
      }),
    ).rejects.toBe(failure)
    const after = await db.withTenant(A.companyId, tx =>
      tx.execute(sql`select count(*)::int as n from ${branches} where ${branches.empresaId} = ${A.companyId}`),
    )
    expect(after.rows[0]?.n).toBe(1)
  })

  it('rechaza un empresaId que no es UUID antes de tocar la base', async () => {
    await expect(db.withTenant('empresa-1', () => Promise.resolve())).rejects.toThrow()
  })

  it('read() corre en una transacción READ ONLY: Postgres rechaza cualquier escritura', async () => {
    const error = await db
      .withTenant(A.companyId, tx => tx.execute(sql`update ${branches} set name = name`), 'read only')
      .catch((e: unknown) => e)
    expect(pgCode(error)).toBe('25006')
  })
})
