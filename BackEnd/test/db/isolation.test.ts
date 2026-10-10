// Suite funcional de aislamiento entre empresas (ADR-BE-002). Dos empresas, A y B, con una fila
// en cada tabla; con el tenant de A, ninguna operación alcanza las filas de B. Cada tabla con RLS
// necesita un caso en ISOLATION_CASES: el primer test compara contra el catálogo y falla si falta alguno.
// Corre como sdgpd_app_test a través de Database.withTenant, el mismo camino que la aplicación.
import { createHash } from 'node:crypto'
import { eq, type SQL, sql } from 'drizzle-orm'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Database, type TenantTx } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import {
  auditLog,
  branches,
  companies,
  documentCounters,
  drivers,
  idempotencyKeys,
  loginAttempts,
  motivos,
  refreshTokens,
  rolePermissions,
  roles,
  suppliers,
  userBranches,
  users,
  vehicles,
} from '../../src/db/schema/index.ts'
import { INSUFFICIENT_PRIVILEGE, pgCode, rawTestClient, testConfig } from '../support/db.ts'
import { testPasswordHash } from '../support/tenants.ts'

type Tenant = {
  companyId: string
  branchId: string
  roleId: string
  permissionId: string
  userId: string
  userBranchId: string
  refreshTokenId: string
  idempotencyKey: string
  auditId: string
  supplierId: string
  vehicleId: string
  driverId: string
  motivoId: string
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

/** Desde BE-1a, user_id tiene FK a users: la fila de prueba de cada tenant usa su usuario real. */
const auditRow = (empresaId: string, userId: string, id = newId()) => ({
  id,
  empresaId,
  userId,
  action: 'create' as const,
  entity: 'isolation-probe',
  entityId: newId(),
  before: null,
  after: { probe: true },
  requestId: newId(),
})

/** Un vehículo de prueba (BE-2). */
const vehicleRow = (empresaId: string, id: string, patente: string) => ({
  id,
  empresaId,
  patente,
  tipo: 'Camioneta',
  capacidadBultos: 1,
  capacidadPesoKg: 1,
  capacidadVolumenM3: 1,
  capacidadRefrigerado: false,
  capacidadZonasHabilitadas: ['Centro'],
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
    insertWith: (tx, empresaId) => tx.insert(auditLog).values(auditRow(empresaId, newId())),
    appendOnly: true,
  },
  document_counters: {
    tenantColumn: 'empresa_id',
    match: t => sql`empresa_id = ${t.companyId} and series = 'PED'`,
    mutation: sql`last_value = last_value + 1000`,
    probe: sql`last_value`,
    insertWith: (tx, empresaId) => tx.insert(documentCounters).values({ empresaId, series: 'REM', lastValue: 1 }),
  },
  // Identidad (BE-1a). Las FK de los insertWith apuntan a filas inexistentes a propósito: RLS rechaza
  // antes (WITH CHECK se evalúa antes que la FK, que es un trigger AFTER).
  roles: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.roleId}`,
    mutation: sql`name = 'modificada por A'`,
    probe: sql`name`,
    insertWith: (tx, empresaId) => tx.insert(roles).values({ id: newId(), empresaId, name: `intruso ${newId()}` }),
  },
  role_permissions: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.permissionId}`,
    mutation: sql`action = 'forzar'`,
    probe: sql`action`,
    insertWith: (tx, empresaId) =>
      tx.insert(rolePermissions).values({ id: newId(), empresaId, roleId: newId(), module: 'orders', action: 'ver' }),
  },
  users: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.userId}`,
    mutation: sql`full_name = 'modificada por A'`,
    probe: sql`full_name`,
    insertWith: (tx, empresaId) =>
      tx.insert(users).values({
        id: newId(),
        empresaId,
        email: `intruso-${newId()}@sdgpd.test`,
        fullName: 'intruso',
        passwordHash: '$argon2id$intruso',
        roleId: newId(),
      }),
  },
  user_branches: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.userBranchId}`,
    mutation: sql`branch_id = branch_id`,
    probe: sql`branch_id`,
    insertWith: (tx, empresaId) => tx.insert(userBranches).values({ id: newId(), empresaId, userId: newId(), branchId: newId() }),
  },
  refresh_tokens: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.refreshTokenId}`,
    mutation: sql`revoked_at = now()`,
    probe: sql`revoked_at`,
    insertWith: (tx, empresaId) =>
      tx.insert(refreshTokens).values({
        id: newId(),
        empresaId,
        userId: newId(),
        familyId: newId(),
        tokenHash: '0'.repeat(64),
        expiresAt: sql`now() + interval '1 day'`,
      }),
  },
  login_attempts: {
    tenantColumn: 'empresa_id',
    match: t => sql`user_id = ${t.userId}`,
    mutation: sql`failed_count = failed_count + 100`,
    probe: sql`failed_count`,
    insertWith: (tx, empresaId) =>
      tx.insert(loginAttempts).values({ empresaId, userId: newId(), failedCount: 1, windowStartedAt: sql`now()` }),
  },
  // Maestros (BE-2).
  suppliers: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.supplierId}`,
    mutation: sql`name = 'modificada por A'`,
    probe: sql`name`,
    insertWith: (tx, empresaId) => tx.insert(suppliers).values({ id: newId(), empresaId, name: 'intruso', cuit: '20123456789', category: 'x' }),
  },
  vehicles: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.vehicleId}`,
    mutation: sql`tipo = 'modificada por A'`,
    probe: sql`tipo`,
    insertWith: (tx, empresaId) => tx.insert(vehicles).values(vehicleRow(empresaId, newId(), 'ZZ999ZZ')),
  },
  drivers: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.driverId}`,
    mutation: sql`nombre = 'modificada por A'`,
    probe: sql`nombre`,
    insertWith: (tx, empresaId) => tx.insert(drivers).values({ id: newId(), empresaId, nombre: 'intruso', licencia: 'X-999', telefono: '1' }),
  },
  motivos: {
    tenantColumn: 'empresa_id',
    match: t => sql`id = ${t.motivoId}`,
    mutation: sql`descripcion = 'modificada por A'`,
    probe: sql`descripcion`,
    insertWith: (tx, empresaId) => tx.insert(motivos).values({ id: newId(), empresaId, codigo: 'INTRUSO', tipo: 'rechazo', descripcion: 'intruso' }),
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
    roleId: newId(),
    permissionId: newId(),
    userId: newId(),
    userBranchId: newId(),
    refreshTokenId: newId(),
    idempotencyKey: newId(),
    auditId: newId(),
    supplierId: newId(),
    vehicleId: newId(),
    driverId: newId(),
    motivoId: newId(),
    label,
  }
  const passwordHash = await testPasswordHash()
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
    await tx.insert(roles).values({ id: tenant.roleId, empresaId: tenant.companyId, name: `rol ${label}` })
    await tx
      .insert(rolePermissions)
      .values({ id: tenant.permissionId, empresaId: tenant.companyId, roleId: tenant.roleId, module: 'orders', action: 'ver' })
    await tx.insert(users).values({
      id: tenant.userId,
      empresaId: tenant.companyId,
      email: `isolation-${label}-${tenant.userId}@sdgpd.test`.toLowerCase(),
      fullName: `usuario ${label}`,
      passwordHash,
      roleId: tenant.roleId,
    })
    await tx
      .insert(userBranches)
      .values({ id: tenant.userBranchId, empresaId: tenant.companyId, userId: tenant.userId, branchId: tenant.branchId })
    await tx.insert(refreshTokens).values({
      id: tenant.refreshTokenId,
      empresaId: tenant.companyId,
      userId: tenant.userId,
      familyId: newId(),
      tokenHash: createHash('sha256').update(tenant.refreshTokenId).digest('hex'),
      expiresAt: sql`now() + interval '1 day'`,
    })
    await tx
      .insert(loginAttempts)
      .values({ empresaId: tenant.companyId, userId: tenant.userId, failedCount: 1, windowStartedAt: sql`now()` })
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
    await tx.insert(auditLog).values(auditRow(tenant.companyId, tenant.userId, tenant.auditId))
    await tx.insert(documentCounters).values({ empresaId: tenant.companyId, series: 'PED', lastValue: 5 })
    await tx.insert(suppliers).values({ id: tenant.supplierId, empresaId: tenant.companyId, name: `proveedor ${label}`, cuit: '30-11111111-1', category: 'x' })
    await tx.insert(vehicles).values(vehicleRow(tenant.companyId, tenant.vehicleId, 'AA111AA'))
    await tx
      .insert(drivers)
      .values({ id: tenant.driverId, empresaId: tenant.companyId, nombre: `chofer ${label}`, licencia: 'B-111', telefono: '1', usuarioId: tenant.userId })
    await tx.insert(motivos).values({ id: tenant.motivoId, empresaId: tenant.companyId, codigo: 'PRUEBA', tipo: 'rechazo', descripcion: `motivo ${label}` })
  })
  return tenant
}

/**
 * Borra la empresa de prueba. audit_log no se puede borrar (append-only): su fila queda, por diseño.
 * Desde BE-1a esa fila tiene FK al usuario, así que el usuario, su rol y la empresa tampoco se pueden
 * borrar: la verificación exige que quede EXACTAMENTE eso, y que borrar al usuario falle por la FK.
 */
async function removeTenant(t: Tenant | undefined): Promise<void> {
  if (t === undefined) return
  await db.withTenant(t.companyId, async tx => {
    await tx.delete(drivers).where(eq(drivers.empresaId, t.companyId))
    await tx.delete(vehicles).where(eq(vehicles.empresaId, t.companyId))
    await tx.delete(suppliers).where(eq(suppliers.empresaId, t.companyId))
    await tx.delete(motivos).where(eq(motivos.empresaId, t.companyId))
    await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.empresaId, t.companyId))
    await tx.delete(documentCounters).where(eq(documentCounters.empresaId, t.companyId))
    await tx.delete(loginAttempts).where(eq(loginAttempts.empresaId, t.companyId))
    await tx.delete(refreshTokens).where(eq(refreshTokens.empresaId, t.companyId))
    await tx.delete(userBranches).where(eq(userBranches.empresaId, t.companyId))
    await tx.delete(rolePermissions).where(eq(rolePermissions.empresaId, t.companyId))
    await tx.delete(branches).where(eq(branches.empresaId, t.companyId))
    // Con FORCE RLS nadie ve todas las filas, ni el dueño: la limpieza se verifica dentro del tenant.
    const left = await tx.execute(
      sql`select (select count(*) from ${branches})::int + (select count(*) from ${idempotencyKeys})::int
                + (select count(*) from ${documentCounters})::int + (select count(*) from ${loginAttempts})::int
                + (select count(*) from ${refreshTokens})::int + (select count(*) from ${userBranches})::int
                + (select count(*) from ${rolePermissions})::int + (select count(*) from ${suppliers})::int
                + (select count(*) from ${vehicles})::int + (select count(*) from ${drivers})::int
                + (select count(*) from ${motivos})::int as n,
              (select count(*) from ${users})::int as users, (select count(*) from ${roles})::int as roles,
              (select count(*) from ${companies})::int as companies`,
    )
    if (JSON.stringify(left.rows[0]) !== JSON.stringify({ n: 0, users: 1, roles: 1, companies: 1 })) {
      throw new Error(`la limpieza de la empresa de test ${t.label} dejó otra cosa: ${JSON.stringify(left.rows[0])}`)
    }
  })
  const blocked = await db.withTenant(t.companyId, tx => tx.delete(users).where(eq(users.id, t.userId))).catch((e: unknown) => e)
  if (pgCode(blocked) !== '23503') throw new Error(`borrar un usuario auditado tenía que fallar por FK (23503): ${String(blocked)}`)
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
