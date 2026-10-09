// Idempotencia (ADR-BE-005 › Idempotencia, sub-decisiones 1, 2 y 8), por HTTP contra la app completa.
import { errorBodySchema } from '@sdgpd/contracts'
import { and, count, eq, sql } from 'drizzle-orm'
import type pg from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { newId } from '../../src/db/ids.ts'
import { canonicalJson, payloadHash } from '../../src/db/idempotency.ts'
import { auditLog, branches, idempotencyKeys } from '../../src/db/schema/index.ts'
import { actorHeaders, createProbeApp, type ProbeApp } from '../support/probe-app.ts'
import { rawTestClient } from '../support/db.ts'
import { createTestCompany, createTestUser, removeTestCompany, type TestTenant } from '../support/tenants.ts'

let probe: ProbeApp
let A: TestTenant
let B: TestTenant

beforeAll(async () => {
  probe = await createProbeApp()
  A = await createTestCompany(probe.database, 'idem-A')
  B = await createTestCompany(probe.database, 'idem-B')
})

afterAll(async () => {
  try {
    await removeTestCompany(probe.database, A)
    await removeTestCompany(probe.database, B)
  } finally {
    await probe?.app.close()
  }
})

const post = (path: string, tenant: TestTenant, key: string | undefined, body: object) => {
  const req = request(probe.app.getHttpServer()).post(path).set(actorHeaders(tenant.empresaId, tenant.userId))
  return (key === undefined ? req : req.set('Idempotency-Key', key)).send(body)
}

async function countBranches(tenant: TestTenant, code: string): Promise<number> {
  return probe.database.withTenant(tenant.empresaId, async tx => {
    const rows = await tx.select({ n: count() }).from(branches).where(eq(branches.code, code))
    return rows[0]?.n ?? 0
  })
}

async function keyRows(tenant: TestTenant, key: string): Promise<number> {
  return probe.database.withTenant(tenant.empresaId, async tx => {
    const rows = await tx.select({ n: count() }).from(idempotencyKeys).where(eq(idempotencyKeys.key, key))
    return rows[0]?.n ?? 0
  })
}

describe('payload hash', () => {
  it('canonicaliza: el orden de las claves no cambia el hash, el contenido sí', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}')
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }))
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }))
  })
})

describe('Idempotency-Key', () => {
  it('un POST sin clave, o con una que no es UUID, es 400 idempotency-key-required y no ejecuta nada', async () => {
    const code = `NK-${newId().slice(-8)}`
    for (const key of [undefined, 'no-es-uuid']) {
      const res = await post('/probe/branches', A, key, { name: 'x', code })
      expect(res.status).toBe(400)
      expect(errorBodySchema.parse(res.body).code).toBe('idempotency-key-required')
    }
    expect(await countBranches(A, code)).toBe(0)
  })

  it('misma clave y mismo payload: replay con el mismo status y body, y un solo efecto', async () => {
    const key = newId()
    const code = `RP-${key.slice(-8)}`
    const first = await post('/probe/branches', A, key, { name: 'Replay', code })
    const second = await post('/probe/branches', A, key, { code, name: 'Replay' })
    expect(first.status).toBe(201)
    expect(second.status).toBe(first.status)
    expect(second.body).toEqual(first.body)
    expect(first.headers['idempotent-replayed']).toBeUndefined()
    expect(second.headers['idempotent-replayed']).toBe('true')
    expect(await countBranches(A, code)).toBe(1)
  })

  it('el replay respeta el status de la ruta (@HttpCode(200))', async () => {
    const key = newId()
    const body = { name: 'Doscientos', code: `H2-${key.slice(-8)}` }
    const first = await post('/probe/branches-200', A, key, body)
    const second = await post('/probe/branches-200', A, key, body)
    expect([first.status, second.status]).toEqual([200, 200])
    expect(second.body).toEqual(first.body)
  })

  it('misma clave con otro payload: 422 idempotency-key-reused, sin segundo efecto', async () => {
    const key = newId()
    const code = `RU-${key.slice(-8)}`
    expect((await post('/probe/branches', A, key, { name: 'Uno', code })).status).toBe(201)
    const res = await post('/probe/branches', A, key, { name: 'Otro', code: `${code}-2` })
    expect(res.status).toBe(422)
    expect(errorBodySchema.parse(res.body).code).toBe('idempotency-key-reused')
    expect(await countBranches(A, `${code}-2`)).toBe(0)
  })

  it('la clave es por usuario y por operación: otro usuario u otra ruta con la misma clave ejecutan', async () => {
    const key = newId()
    // Desde BE-1a el usuario tiene que existir (FK de idempotency_keys.user_id): otro usuario real de A.
    const otherUser = { ...A, userId: await createTestUser(probe.database, A.empresaId, 'idem-otro') }
    expect((await post('/probe/branches', A, key, { name: 'u1', code: `U1-${key.slice(-8)}` })).status).toBe(201)
    expect((await post('/probe/branches', otherUser, key, { name: 'u2', code: `U2-${key.slice(-8)}` })).status).toBe(201)
    expect((await post('/probe/numbers', A, key, { series: 'PED' })).status).toBe(201)
  })

  it('un comando que falla no deja la clave (ni sus escrituras), y el reintento se ejecuta de nuevo', async () => {
    const key = newId()
    const code = `FL-${key.slice(-8)}`
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await post('/probe/failing', A, key, { name: 'falla', code })
      expect(res.status).toBe(422)
      expect(res.body).toMatchObject({ code: 'probe-failure' })
      expect(await keyRows(A, key)).toBe(0)
    }
    expect(await countBranches(A, code)).toBe(0)
  })

  it('dos requests concurrentes con la misma clave: una sola ejecución y la misma respuesta para las dos', async () => {
    const key = newId()
    const code = `CC-${key.slice(-8)}`
    const body = { name: 'Concurrente', code }
    const [r1, r2] = await Promise.all([post('/probe/slow-branches', A, key, body), post('/probe/slow-branches', A, key, body)])
    expect([r1.status, r2.status]).toEqual([201, 201])
    expect(r2.body).toEqual(r1.body)
    // Una de las dos esperó en el índice único y terminó en replay.
    expect([r1.headers['idempotent-replayed'], r2.headers['idempotent-replayed']].filter(h => h === 'true')).toHaveLength(1)
    expect(await countBranches(A, code)).toBe(1)
    const audits = await probe.database.withTenant(A.empresaId, tx =>
      tx.select({ n: count() }).from(auditLog).where(and(eq(auditLog.entity, 'branch'), eq(auditLog.entityId, String((r1.body as { id: string }).id)))),
    )
    expect(audits[0]?.n).toBe(1)
  })
})

describe('rutas /auth/*', () => {
  it('no exigen Idempotency-Key ni actor', async () => {
    const res = await request(probe.app.getHttpServer()).post('/auth/probe').send({})
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('limpieza de claves vencidas', () => {
  async function insertKey(tenant: TestTenant, expired: boolean): Promise<string> {
    const key = newId()
    await probe.database.withTenant(tenant.empresaId, tx =>
      tx.insert(idempotencyKeys).values({
        empresaId: tenant.empresaId,
        userId: tenant.userId,
        operation: 'POST /probe/cleanup',
        key,
        payloadHash: 'x',
        responseStatus: 201,
        responseBody: {},
        expiresAt: expired ? sql`now() - interval '1 minute'` : sql`now() + interval '48 hours'`,
      }),
    )
    return key
  }

  it('borra solo las vencidas, de todas las empresas, sin tenant', async () => {
    const expiredA = await insertKey(A, true)
    const expiredB = await insertKey(B, true)
    const freshA = await insertKey(A, false)
    const deleted = await probe.database.cleanupExpiredIdempotencyKeys()
    expect(deleted).toBeGreaterThanOrEqual(2)
    expect(await keyRows(A, expiredA)).toBe(0)
    expect(await keyRows(B, expiredB)).toBe(0)
    expect(await keyRows(A, freshA)).toBe(1)
  })

  it('si otra instancia tiene el advisory lock, no hace nada (devuelve null)', async () => {
    const expired = await insertKey(A, true)
    const holder: pg.Client = await rawTestClient()
    try {
      await holder.query('begin')
      await holder.query(`select pg_advisory_xact_lock(hashtext(current_schema() || ':idempotency-cleanup'))`)
      expect(await probe.database.cleanupExpiredIdempotencyKeys()).toBeNull()
      expect(await keyRows(A, expired)).toBe(1)
      await holder.query('commit')
    } finally {
      await holder.end()
    }
    expect(await probe.database.cleanupExpiredIdempotencyKeys()).toBeGreaterThanOrEqual(1)
    expect(await keyRows(A, expired)).toBe(0)
  })
})
