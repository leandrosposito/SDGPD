// Idempotency-Key en PUT/PATCH/DELETE (ADR-BE-005, resolución de la objeción 3): opcional; si viene,
// mismas reglas que en POST. Por HTTP contra la app completa, con la ruta PUT de la app de prueba.
import { errorBodySchema } from '@sdgpd/contracts'
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { newId } from '../../src/db/ids.ts'
import { branches } from '../../src/db/schema/index.ts'
import { actorHeaders, createProbeApp, type ProbeApp } from '../support/probe-app.ts'
import { createTestCompany, removeTestCompany, type TestTenant } from '../support/tenants.ts'

let probe: ProbeApp
let A: TestTenant

beforeAll(async () => {
  probe = await createProbeApp()
  A = await createTestCompany(probe.database, 'idem-put')
})

afterAll(async () => {
  try {
    await removeTestCompany(probe.database, A)
  } finally {
    await probe?.app.close()
  }
})

const server = () => probe.app.getHttpServer()

async function createBranch(): Promise<string> {
  const res = await request(server())
    .post('/api/probe/branches')
    .set(actorHeaders(A.empresaId, A.userId))
    .set('Idempotency-Key', newId())
    .send({ name: 'Original', code: `PUT-${newId().slice(-8)}` })
  expect(res.status).toBe(201)
  return (res.body as { id: string }).id
}

const put = (id: string, key: string | undefined, body: object) => {
  const req = request(server()).put(`/api/probe/branches/${id}`).set(actorHeaders(A.empresaId, A.userId))
  return (key === undefined ? req : req.set('Idempotency-Key', key)).send(body)
}

async function branchRow(id: string) {
  const rows = await probe.database.withTenant(A.empresaId, tx =>
    tx.select({ name: branches.name, version: branches.version }).from(branches).where(eq(branches.id, id)),
  )
  return rows[0]
}

describe('PUT con Idempotency-Key', () => {
  it('repetido con la misma clave y el mismo payload: la respuesta original, sin 409, y un solo efecto', async () => {
    const id = await createBranch()
    const key = newId()
    const first = await put(id, key, { name: 'Cambiada', version: 1 })
    const second = await put(id, key, { version: 1, name: 'Cambiada' })
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ id, version: 2 })
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(first.headers['idempotent-replayed']).toBeUndefined()
    expect(second.headers['idempotent-replayed']).toBe('true')
    expect(await branchRow(id)).toEqual({ name: 'Cambiada', version: 2 })
  })

  it('la misma clave con otro payload: 422 idempotency-key-reused, sin efecto', async () => {
    const id = await createBranch()
    const key = newId()
    expect((await put(id, key, { name: 'Uno', version: 1 })).status).toBe(200)
    const res = await put(id, key, { name: 'Otro', version: 2 })
    expect(res.status).toBe(422)
    expect(errorBodySchema.parse(res.body).code).toBe('idempotency-key-reused')
    expect(await branchRow(id)).toEqual({ name: 'Uno', version: 2 })
  })

  it('la misma clave y el mismo body sobre otro :id: 422 (el hash cubre los parámetros de la ruta)', async () => {
    const first = await createBranch()
    const other = await createBranch()
    const key = newId()
    expect((await put(first, key, { name: 'Igual', version: 1 })).status).toBe(200)
    const res = await put(other, key, { name: 'Igual', version: 1 })
    expect(res.status).toBe(422)
    expect(errorBodySchema.parse(res.body).code).toBe('idempotency-key-reused')
    expect(await branchRow(other)).toEqual({ name: 'Original', version: 1 })
  })

  it('una clave que no es UUID: 400 idempotency-key-required, sin efecto', async () => {
    const id = await createBranch()
    const res = await put(id, 'no-es-uuid', { name: 'X', version: 1 })
    expect(res.status).toBe(400)
    expect(errorBodySchema.parse(res.body).code).toBe('idempotency-key-required')
    expect(await branchRow(id)).toEqual({ name: 'Original', version: 1 })
  })
})

describe('PUT sin Idempotency-Key', () => {
  it('funciona como antes: aplica, y repetido con la versión vieja da 409 version-conflict', async () => {
    const id = await createBranch()
    const first = await put(id, undefined, { name: 'Sin clave', version: 1 })
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ id, version: 2 })
    const second = await put(id, undefined, { name: 'Sin clave', version: 1 })
    expect(second.status).toBe(409)
    const body = errorBodySchema.parse(second.body)
    expect(body.code).toBe('version-conflict')
    expect(body.details).toEqual({ currentVersion: 2 })
  })
})
