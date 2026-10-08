// Version (ADR-BE-005 › Concurrencia), auditoría (› Auditoría, sub-decisión 7) y contadores (ADR-BE-006 §4).
import { errorBodySchema } from '@sdgpd/contracts'
import { and, asc, eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Database } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { auditLog, branches } from '../../src/db/schema/index.ts'
import { INSUFFICIENT_PRIVILEGE, pgCode, rawTestClient, testConfig } from '../support/db.ts'
import { actorHeaders, createProbeApp, type ProbeApp } from '../support/probe-app.ts'
import { createTestCompany, removeTestCompany, type TestTenant } from '../support/tenants.ts'

let probe: ProbeApp
let A: TestTenant
let B: TestTenant

beforeAll(async () => {
  probe = await createProbeApp()
  A = await createTestCompany(probe.database, 'mut-A')
  B = await createTestCompany(probe.database, 'mut-B')
})

afterAll(async () => {
  try {
    await removeTestCompany(probe.database, A)
    await removeTestCompany(probe.database, B)
  } finally {
    await probe?.app.close()
  }
})

const server = () => probe.app.getHttpServer()

async function createBranch(tenant: TestTenant, code: string): Promise<{ id: string; version: number }> {
  const res = await request(server())
    .post('/probe/branches')
    .set(actorHeaders(tenant.empresaId, tenant.userId))
    .set('Idempotency-Key', newId())
    .send({ name: `Sucursal ${code}`, code })
  expect(res.status).toBe(201)
  return res.body as { id: string; version: number }
}

const put = (tenant: TestTenant, id: string, body: object) =>
  request(server()).put(`/probe/branches/${id}`).set(actorHeaders(tenant.empresaId, tenant.userId)).send(body)

async function auditOf(tenant: TestTenant, entityId: string) {
  return probe.database.withTenant(tenant.empresaId, tx =>
    tx
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'branch'), eq(auditLog.entityId, entityId)))
      .orderBy(asc(auditLog.at), asc(auditLog.id)),
  )
}

describe('version', () => {
  it('una actualización con la versión vigente la incrementa', async () => {
    const created = await createBranch(A, `V1-${newId().slice(-8)}`)
    expect(created.version).toBe(1)
    const res = await put(A, created.id, { name: 'Renombrada', version: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: created.id, version: 2 })
  })

  it('una versión vieja da 409 version-conflict con currentVersion, y no cambia nada', async () => {
    const created = await createBranch(A, `V2-${newId().slice(-8)}`)
    expect((await put(A, created.id, { name: 'Primera', version: 1 })).status).toBe(200)
    const res = await put(A, created.id, { name: 'Pisada', version: 1 })
    expect(res.status).toBe(409)
    expect(errorBodySchema.parse(res.body)).toMatchObject({ code: 'version-conflict', details: { currentVersion: 2 } })
    const [row] = await probe.database.withTenant(A.empresaId, tx => tx.select().from(branches).where(eq(branches.id, created.id)))
    expect(row).toMatchObject({ name: 'Primera', version: 2 })
  })

  it('un id inexistente da 404 not-found', async () => {
    const res = await put(A, newId(), { name: 'x', version: 1 })
    expect(res.status).toBe(404)
    expect(errorBodySchema.parse(res.body)).toMatchObject({ code: 'not-found', details: { entity: 'branch' } })
  })

  it('una fila de otra empresa es, para A, inexistente: 404', async () => {
    const ofB = await createBranch(B, `VB-${newId().slice(-8)}`)
    expect((await put(A, ofB.id, { name: 'robada', version: 1 })).status).toBe(404)
  })
})

describe('auditoría', () => {
  it('crear y actualizar dejan su registro, con before y after como la fila completa, actor y request', async () => {
    const code = `AU-${newId().slice(-8)}`
    const created = await createBranch(A, code)
    const res = await put(A, created.id, { name: 'Auditada', version: 1 })
    const requestId = String(res.headers['x-request-id'])
    const rows = await auditOf(A, created.id)
    expect(rows.map(r => r.action)).toEqual(['create', 'update'])
    const [create, update] = rows
    expect(create).toMatchObject({ empresaId: A.empresaId, userId: A.userId, before: null })
    expect(create?.after).toMatchObject({ id: created.id, empresa_id: A.empresaId, version: 1, status: 'active' })
    expect(update).toMatchObject({ requestId, userId: A.userId })
    expect(update?.before).toMatchObject({ id: created.id, version: 1, name: `Sucursal ${code}` })
    expect(update?.after).toMatchObject({ id: created.id, version: 2, name: 'Auditada' })
    // La fila completa: todas las columnas de branches.
    expect(Object.keys(update?.after ?? {}).sort()).toEqual(
      ['address', 'city', 'code', 'created_at', 'empresa_id', 'id', 'name', 'status', 'version'].sort(),
    )
  })

  it('un comando que falla (rollback) no deja registro de auditoría', async () => {
    const code = `RB-${newId().slice(-8)}`
    const res = await request(server())
      .post('/probe/failing')
      .set(actorHeaders(A.empresaId, A.userId))
      .set('Idempotency-Key', newId())
      .send({ name: 'falla', code })
    expect(res.status).toBe(422)
    const audits = await probe.database.withTenant(A.empresaId, tx =>
      tx.select().from(auditLog).where(and(eq(auditLog.userId, A.userId), eq(auditLog.entity, 'branch'))),
    )
    const after = audits.map(a => (a.after ?? {}) as Record<string, unknown>)
    expect(after.some(a => a.code === code)).toBe(false)
  })

  it('un 409 de versión no deja registro', async () => {
    const created = await createBranch(A, `AC-${newId().slice(-8)}`)
    expect((await put(A, created.id, { name: 'x', version: 7 })).status).toBe(409)
    expect((await auditOf(A, created.id)).map(r => r.action)).toEqual(['create'])
  })

  it('sdgpd_app_test no puede hacer UPDATE ni DELETE sobre audit_log (permiso denegado)', async () => {
    const client = await rawTestClient()
    try {
      await client.query('begin')
      await client.query(`select set_config('app.empresa_id', $1, true)`, [A.empresaId])
      const update = await client.query(`update audit_log set entity = 'x'`).catch((e: unknown) => e)
      expect(pgCode(update)).toBe(INSUFFICIENT_PRIVILEGE)
      await client.query('rollback')
      await client.query('begin')
      await client.query(`select set_config('app.empresa_id', $1, true)`, [A.empresaId])
      const del = await client.query('delete from audit_log').catch((e: unknown) => e)
      expect(pgCode(del)).toBe(INSUFFICIENT_PRIVILEGE)
      await client.query('rollback')
    } finally {
      await client.end()
    }
  })
})

describe('contadores', () => {
  it('20 llamadas concurrentes devuelven 1 a 20, sin repetir ni saltear', async () => {
    const db = new Database(testConfig(4))
    const tenant = await createTestCompany(db, 'cnt')
    try {
      const actor = { ...tenant, requestId: newId() }
      const numbers = await Promise.all(Array.from({ length: 20 }, () => db.command(actor, tx => tx.nextNumber('PED'))))
      expect([...numbers].sort()).toEqual(Array.from({ length: 20 }, (_, i) => `PED-${String(i + 1).padStart(6, '0')}`))
      // Un rollback no consume número.
      await expect(
        db.command(actor, async tx => {
          await tx.nextNumber('PED')
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      expect(await db.command(actor, tx => tx.nextNumber('PED'))).toBe('PED-000021')
      // Otra serie de la misma empresa arranca en 1.
      expect(await db.command(actor, tx => tx.nextNumber('REM'))).toBe('REM-000001')
    } finally {
      await removeTestCompany(db, tenant)
      await db.close()
    }
  })

  it('dos empresas no comparten numeración', async () => {
    const res = (tenant: TestTenant) =>
      request(server())
        .post('/probe/numbers')
        .set(actorHeaders(tenant.empresaId, tenant.userId))
        .set('Idempotency-Key', newId())
        .send({ series: 'OC' })
    expect((await res(A)).body).toEqual({ number: 'OC-000001' })
    expect((await res(A)).body).toEqual({ number: 'OC-000002' })
    expect((await res(B)).body).toEqual({ number: 'OC-000001' })
  })
})
