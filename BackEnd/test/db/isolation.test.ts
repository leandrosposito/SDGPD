// Suite funcional de aislamiento entre empresas (ADR-BE-002). Dos empresas, A y B, con sus filas;
// con el tenant de A, ninguna operación alcanza las filas de B. Cada tabla con RLS necesita un caso
// en ISOLATION_CASES: el primer test compara contra el catálogo y falla si falta alguno.
// Corre como sdgpd_app_test a través de Database.withTenant, el mismo camino que la aplicación.
import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Database, type TenantTx } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { branches, companies } from '../../src/db/schema/index.ts'
import { INSUFFICIENT_PRIVILEGE, pgCode, rawTestClient, testConfig } from '../support/db.ts'

type Tenant = { companyId: string; branchId: string; label: string }

type IsolationCase = {
  /** Columna que lleva el tenant (empresa_id; en companies, el propio id). */
  tenantColumn: string
  /** Columna de texto que el test intenta modificar. */
  mutableColumn: string
  /** Id de la fila de esta tabla que pertenece al tenant. */
  rowOf: (t: Tenant) => string
  /** Inserta una fila NUEVA de esta tabla con el empresa_id dado. */
  insertWith: (tx: TenantTx, empresaId: string) => Promise<unknown>
}

const ISOLATION_CASES: Record<string, IsolationCase> = {
  companies: {
    tenantColumn: 'id',
    mutableColumn: 'name',
    rowOf: t => t.companyId,
    insertWith: (tx, empresaId) =>
      tx.insert(companies).values({ id: empresaId, name: 'intrusa', timezone: 'America/Argentina/Cordoba' }),
  },
  branches: {
    tenantColumn: 'empresa_id',
    mutableColumn: 'name',
    rowOf: t => t.branchId,
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
}

const runId = newId()
let db: Database
let raw: pg.Client
let A: Tenant
let B: Tenant

async function createTenant(label: string): Promise<Tenant> {
  const tenant = { companyId: newId(), branchId: newId(), label }
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
  })
  return tenant
}

async function removeTenant(t: Tenant | undefined): Promise<void> {
  if (t === undefined) return
  await db.withTenant(t.companyId, async tx => {
    await tx.execute(sql`delete from ${branches} where ${branches.empresaId} = ${t.companyId}`)
    await tx.execute(sql`delete from ${companies} where ${companies.id} = ${t.companyId}`)
    // Con FORCE RLS nadie ve todas las filas, ni el dueño: la limpieza se verifica dentro del tenant.
    const left = await tx.execute(
      sql`select (select count(*) from ${branches})::int + (select count(*) from ${companies})::int as n`,
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
  const mutable = ident(c.mutableColumn)

  it('con el tenant de A ve su fila y ninguna fila de B', async () => {
    const counts = await db.withTenant(A.companyId, async tx => {
      const own = await tx.execute(sql`select count(*)::int as n from ${T} where id = ${c.rowOf(A)}`)
      const foreign = await tx.execute(sql`select count(*)::int as n from ${T} where id = ${c.rowOf(B)}`)
      const others = await tx.execute(sql`select count(*)::int as n from ${T} where ${tenantCol} <> ${A.companyId}`)
      return { own: own.rows[0]?.n, foreign: foreign.rows[0]?.n, others: others.rows[0]?.n }
    })
    expect(counts).toEqual({ own: 1, foreign: 0, others: 0 })
  })

  it('con el tenant de A no modifica filas de B', async () => {
    const updated = await db.withTenant(A.companyId, tx =>
      tx.execute(sql`update ${T} set ${mutable} = 'modificada por A' where id = ${c.rowOf(B)}`),
    )
    expect(updated.rowCount).toBe(0)
    const seenByB = await db.withTenant(B.companyId, tx =>
      tx.execute(sql`select ${mutable} as v from ${T} where id = ${c.rowOf(B)}`),
    )
    expect(seenByB.rows).toHaveLength(1)
    expect(seenByB.rows[0]?.v).not.toBe('modificada por A')
  })

  it('con el tenant de A no borra filas de B', async () => {
    const deleted = await db.withTenant(A.companyId, tx => tx.execute(sql`delete from ${T} where id = ${c.rowOf(B)}`))
    expect(deleted.rowCount).toBe(0)
    const stillThere = await db.withTenant(B.companyId, tx =>
      tx.execute(sql`select count(*)::int as n from ${T} where id = ${c.rowOf(B)}`),
    )
    expect(stillThere.rows[0]?.n).toBe(1)
  })

  it('con el tenant de A no inserta una fila con el empresa_id de B', async () => {
    const error = await db.withTenant(A.companyId, tx => c.insertWith(tx, B.companyId)).catch((e: unknown) => e)
    expect(pgCode(error)).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('con el tenant de A no pasa una fila propia a B', async () => {
    const error = await db
      .withTenant(A.companyId, tx =>
        tx.execute(sql`update ${T} set ${tenantCol} = ${B.companyId} where id = ${c.rowOf(A)}`),
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
})
