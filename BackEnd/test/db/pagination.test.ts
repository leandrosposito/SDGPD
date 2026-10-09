// Paginación offset y cursor, y listas blancas de filtros y orden (ADR-BE-004 › Paginación, › Orden y filtros).
import { errorBodySchema, MAX_PAGE_SIZE, offsetPageSchema, cursorPageSchema } from '@sdgpd/contracts'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { newId } from '../../src/db/ids.ts'
import { branches } from '../../src/db/schema/index.ts'
import { apiPath } from '../../src/http/api-prefix.ts'
import { actorHeaders, createProbeApp, type ProbeApp } from '../support/probe-app.ts'
import { createTestCompany, removeTestCompany, type TestTenant } from '../support/tenants.ts'

const branchItem = z.object({ id: z.uuid(), code: z.string(), name: z.string(), version: z.int() })
const auditItem = z.object({ id: z.uuid(), at: z.string(), action: z.string(), entity: z.string(), entityId: z.uuid() })
const branchPage = offsetPageSchema(branchItem)
const auditPage = cursorPageSchema(auditItem)

const TOTAL = 25
let probe: ProbeApp
let T: TestTenant

beforeAll(async () => {
  probe = await createProbeApp()
  T = await createTestCompany(probe.database, 'page')
  await probe.database.withTenant(T.empresaId, tx =>
    tx.insert(branches).values(
      Array.from({ length: TOTAL }, (_, i) => ({
        id: newId(),
        empresaId: T.empresaId,
        name: `Sucursal ${i}`,
        code: `P-${String(i).padStart(2, '0')}`,
        city: 'x',
        address: 'x',
        status: i % 5 === 0 ? ('inactive' as const) : ('active' as const),
      })),
    ),
  )
})

afterAll(async () => {
  try {
    await removeTestCompany(probe.database, T)
  } finally {
    await probe?.app.close()
  }
})

const get = (path: string, query: Record<string, string | number> = {}) =>
  request(probe.app.getHttpServer()).get(apiPath(path)).query(query).set(actorHeaders(T.empresaId, T.userId))

describe('offset', () => {
  it('total correcto, páginas sin solaparse y orden por la lista blanca', async () => {
    const pages = await Promise.all([1, 2, 3].map(page => get('/probe/branches', { page, pageSize: 10, sortField: 'code' })))
    const parsed = pages.map(p => branchPage.parse(p.body))
    expect(parsed.map(p => [p.total, p.page, p.pageSize, p.items.length])).toEqual([
      [TOTAL, 1, 10, 10],
      [TOTAL, 2, 10, 10],
      [TOTAL, 3, 10, 5],
    ])
    const codes = parsed.flatMap(p => p.items.map(i => i.code))
    expect(codes).toEqual(Array.from({ length: TOTAL }, (_, i) => `P-${String(i).padStart(2, '0')}`))
  })

  it('orden descendente y filtro de la lista blanca', async () => {
    const res = branchPage.parse((await get('/probe/branches', { sortField: 'code', sortDirection: 'desc', status: 'inactive' })).body)
    expect(res.total).toBe(5)
    expect(res.items.map(i => i.code)).toEqual(['P-20', 'P-15', 'P-10', 'P-05', 'P-00'])
  })

  it(`pageSize hasta ${MAX_PAGE_SIZE}; más es 400 invalid-query`, async () => {
    expect((await get('/probe/branches', { pageSize: MAX_PAGE_SIZE })).status).toBe(200)
    const res = await get('/probe/branches', { pageSize: MAX_PAGE_SIZE + 1 })
    expect(res.status).toBe(400)
    expect(errorBodySchema.parse(res.body).code).toBe('invalid-query')
  })

  it('un campo de orden o un filtro fuera de la lista blanca es 400 invalid-query', async () => {
    const invalid: Record<string, string | number>[] = [{ sortField: 'address' }, { city: 'Córdoba' }, { status: 'borrada' }, { sortDirection: 'sideways' }]
    for (const query of invalid) {
      const res = await get('/probe/branches', query)
      expect(res.status, JSON.stringify(query)).toBe(400)
      expect(errorBodySchema.parse(res.body).code).toBe('invalid-query')
    }
  })
})

describe('cursor', () => {
  async function createAudited(n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      const res = await request(probe.app.getHttpServer())
        .post('/api/probe/branches')
        .set(actorHeaders(T.empresaId, T.userId))
        .set('Idempotency-Key', newId())
        .send({ name: 'Cursor', code: `C-${newId().slice(-10)}` })
      expect(res.status).toBe(201)
    }
  }

  it('recorre todo sin repetir ni saltear, con inserciones de por medio', async () => {
    await createAudited(7)
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const query: Record<string, string | number> = { limit: 3, entity: 'branch' }
      if (cursor !== null) query.cursor = cursor
      const res = await get('/probe/audit', query)
      expect(res.status).toBe(200)
      const page = auditPage.parse(res.body)
      seen.push(...page.items.map(i => i.id))
      cursor = page.nextCursor
      // Entre la primera y la segunda página entran 2 registros nuevos: el orden es ascendente, así
      // que aparecen al final del recorrido.
      if (pages === 0) await createAudited(2)
      pages++
    } while (cursor !== null && pages < 20)
    expect(new Set(seen).size).toBe(seen.length)
    const all = auditPage.parse((await get('/probe/audit', { limit: MAX_PAGE_SIZE, entity: 'branch' })).body)
    expect(all.nextCursor).toBeNull()
    expect(seen).toEqual(all.items.map(i => i.id))
    expect(seen).toHaveLength(9)
  })

  it('un cursor inválido o un limit fuera de rango es 400 invalid-query', async () => {
    const invalid: Record<string, string | number>[] = [{ cursor: 'basura' }, { cursor: Buffer.from('["x","y"]').toString('base64url') }, { limit: 0 }, { limit: MAX_PAGE_SIZE + 1 }]
    for (const query of invalid) {
      const res = await get('/probe/audit', query)
      expect(res.status, JSON.stringify(query)).toBe(400)
      expect(errorBodySchema.parse(res.body).code).toBe('invalid-query')
    }
  })
})
