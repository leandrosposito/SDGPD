// Parte 0 de BE-1b: HMAC de idempotencia, guarda de último admin, login con tiempo parejo, limpieza de
// refresh tokens, prefijo global /api y sucursales demo con id fijo. Contra sdgpd_test.
import { createHash } from 'node:crypto'
import { errorBodySchema, rolePageSchema, userPageSchema, userSchema } from '@sdgpd/contracts'
import { eq, sql } from 'drizzle-orm'
import type pg from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DemoBranchConflictError, ensureDemoBranches } from '../../scripts/db/demo-branches.ts'
import { newId } from '../../src/db/ids.ts'
import { canonicalJson, payloadHash } from '../../src/db/idempotency.ts'
import { branches, companies, idempotencyKeys, refreshTokens, userBranches } from '../../src/db/schema/index.ts'
import { REFRESH_COOKIE_PATH } from '../../src/auth/refresh-cookie.ts'
import { rawTestClient, testConfig } from '../support/db.ts'
import {
  type AuthApp,
  createAuthApp,
  createFixtureCompany,
  type FixtureCompany,
  get,
  login,
  loginOk,
  removeFixtureCompany,
  send,
} from '../support/auth-app.ts'
import { insertTestUser, removeTestCompany, TEST_PASSWORD } from '../support/tenants.ts'

let app: AuthApp
let A: FixtureCompany
let B: FixtureCompany

beforeAll(async () => {
  app = await createAuthApp()
  A = await createFixtureCompany(app.database, 'ba')
  B = await createFixtureCompany(app.database, 'bb')
})

afterAll(async () => {
  try {
    await removeFixtureCompany(app.database, A)
    await removeFixtureCompany(app.database, B)
  } finally {
    await app?.app.close()
  }
})

async function roleOf(token: string, roleId: string) {
  return rolePageSchema.parse((await get(app, '/roles?pageSize=100', token)).body).items.find(r => r.id === roleId)
}

async function userOf(token: string, userId: string) {
  return userPageSchema.parse((await get(app, '/users?pageSize=100', token)).body).items.find(u => u.id === userId)
}

describe('1. HMAC del payload de idempotencia', () => {
  it('lo guardado es el HMAC con la clave del servidor, no el SHA-256 del payload', async () => {
    const admin = await loginOk(app, A.admin.email)
    const key = newId()
    const body = {
      email: `hmac-${newId()}@sdgpd.test`,
      fullName: 'Hmac',
      password: 'una-contraseña-inicial',
      roleId: A.limitedRoleId,
      branchIds: [],
    }
    const res = await request(app.app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Idempotency-Key', key)
      .send(body)
    expect(res.status).toBe(201)
    const stored = await app.database.withTenant(A.empresaId, tx =>
      tx.select({ hash: idempotencyKeys.payloadHash }).from(idempotencyKeys).where(eq(idempotencyKeys.key, key)),
    )
    const payload = { params: {}, body }
    expect(stored).toEqual([{ hash: payloadHash(testConfig().idempotency.hmacKey, payload) }])
    expect(stored[0]?.hash).not.toBe(createHash('sha256').update(canonicalJson(payload)).digest('hex'))
  })
})

describe('2. guarda de último admin (V1 de la parte 0)', () => {
  it('el único admin no puede quitarle settings.editar a su rol, desactivarse ni cambiarse de rol: 422 last-admin, sin efecto', async () => {
    const admin = await loginOk(app, A.admin.email)
    const before = await roleOf(admin.accessToken, A.adminRoleId)
    expect(before).toBeDefined()
    const withoutEdit = (before?.permissions ?? []).filter(p => !(p.module === 'settings' && p.action === 'editar'))
    const matrix = await send(app, 'put', `/roles/${A.adminRoleId}/permissions`, admin.accessToken, {
      permissions: withoutEdit,
      version: before?.version,
    })
    expect(matrix.status).toBe(422)
    expect(errorBodySchema.parse(matrix.body).code).toBe('last-admin')

    const me = await userOf(admin.accessToken, A.admin.id)
    const base = { fullName: 'Admin', branchIds: me?.branchIds ?? [], version: me?.version }
    const deactivate = await send(app, 'put', `/users/${A.admin.id}`, admin.accessToken, { ...base, roleId: A.adminRoleId, active: false })
    expect(deactivate.status).toBe(422)
    expect(errorBodySchema.parse(deactivate.body).code).toBe('last-admin')
    const demote = await send(app, 'put', `/users/${A.admin.id}`, admin.accessToken, { ...base, roleId: A.limitedRoleId, active: true })
    expect(demote.status).toBe(422)
    expect(errorBodySchema.parse(demote.body).code).toBe('last-admin')

    // Nada cambió: la matriz, el usuario y el token siguen como antes.
    expect((await roleOf(admin.accessToken, A.adminRoleId))?.version).toBe(before?.version)
    expect(await userOf(admin.accessToken, A.admin.id)).toEqual(me)
  })

  it('con otro admin activo, sí puede quitarse settings.editar (cambiarse de rol)', async () => {
    const admin = await loginOk(app, B.admin.email)
    const email = `admin2-${newId()}@sdgpd.test`
    const created = await send(app, 'post', '/users', admin.accessToken, {
      email,
      fullName: 'Segundo Admin',
      password: TEST_PASSWORD,
      roleId: B.adminRoleId,
      branchIds: [],
    })
    expect(created.status).toBe(201)
    const me = await userOf(admin.accessToken, B.admin.id)
    const demote = await send(app, 'put', `/users/${B.admin.id}`, admin.accessToken, {
      fullName: 'Ex admin',
      roleId: B.limitedRoleId,
      active: true,
      branchIds: me?.branchIds ?? [],
      version: me?.version,
    })
    expect(demote.status).toBe(200)
    expect(userSchema.parse(demote.body).roleId).toBe(B.limitedRoleId)
    // El segundo admin es ahora el último: él tampoco puede quitarse settings.editar.
    const second = await loginOk(app, email)
    const secondUser = userSchema.parse(created.body)
    const last = await send(app, 'put', `/users/${secondUser.id}`, second.accessToken, {
      fullName: 'Segundo Admin',
      roleId: B.adminRoleId,
      active: false,
      branchIds: [],
      version: secondUser.version,
    })
    expect(errorBodySchema.parse(last.body).code).toBe('last-admin')
  })

  it('dos admins que se desactivan entre sí a la vez: uno pasa y el otro recibe 422 (sin write skew)', async () => {
    const company = await createFixtureCompany(app.database, 'bc')
    try {
      const first = await loginOk(app, company.admin.email)
      const email = `admin3-${newId()}@sdgpd.test`
      const second = userSchema.parse(
        (await send(app, 'post', '/users', first.accessToken, { email, fullName: 'Otro', password: TEST_PASSWORD, roleId: company.adminRoleId, branchIds: [] })).body,
      )
      const secondSession = await loginOk(app, email)
      const firstUser = await userOf(first.accessToken, company.admin.id)
      const [r1, r2] = await Promise.all([
        send(app, 'put', `/users/${second.id}`, first.accessToken, { fullName: 'Otro', roleId: company.adminRoleId, active: false, branchIds: [], version: second.version }),
        send(app, 'put', `/users/${company.admin.id}`, secondSession.accessToken, {
          fullName: 'Admin',
          roleId: company.adminRoleId,
          active: false,
          branchIds: firstUser?.branchIds ?? [],
          version: firstUser?.version,
        }),
      ])
      expect([r1.status, r2.status].sort()).toEqual([200, 422])
      const rejected = r1.status === 422 ? r1 : r2
      expect(errorBodySchema.parse(rejected.body).code).toBe('last-admin')
    } finally {
      await removeFixtureCompany(app.database, company)
    }
    // Crea su propia empresa (unas 75 inserciones contra la base remota) y hace dos logins: tarda más de 30 s.
  }, 120_000)
})

describe('3. login con tiempo parejo', () => {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
  async function timed(email: string, password: string): Promise<number> {
    const start = performance.now()
    const res = await login(app, email, password)
    expect(res.status).toBe(401)
    return performance.now() - start
  }

  it('email inexistente y contraseña incorrecta tardan parecido (mediana de 4, dentro de un factor 2)', async () => {
    const missing: number[] = []
    const wrong: number[] = []
    await timed(`calentamiento-${newId()}@sdgpd.test`, 'x')
    for (let i = 0; i < 4; i++) {
      missing.push(await timed(`nadie-${newId()}@sdgpd.test`, 'contraseña-cualquiera'))
      wrong.push(await timed(A.inactive.email, 'contraseña-incorrecta'))
    }
    const ratio = median(missing) / median(wrong)
    expect(ratio, `inexistente ${median(missing).toFixed(0)} ms, incorrecta ${median(wrong).toFixed(0)} ms`).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(2)
  })
})

describe('4. limpieza de refresh tokens vencidos', () => {
  async function insertToken(company: FixtureCompany, expired: boolean): Promise<string> {
    const id = newId()
    await app.database.withTenant(company.empresaId, tx =>
      tx.insert(refreshTokens).values({
        id,
        empresaId: company.empresaId,
        userId: company.admin.id,
        familyId: newId(),
        tokenHash: createHash('sha256').update(id).digest('hex'),
        expiresAt: expired ? sql`now() - interval '1 minute'` : sql`now() + interval '1 day'`,
      }),
    )
    return id
  }
  async function exists(company: FixtureCompany, id: string): Promise<boolean> {
    const rows = await app.database.withTenant(company.empresaId, tx => tx.select({ id: refreshTokens.id }).from(refreshTokens).where(eq(refreshTokens.id, id)))
    return rows.length === 1
  }

  it('borra solo los vencidos, de todas las empresas, sin tenant', async () => {
    const expiredA = await insertToken(A, true)
    const expiredB = await insertToken(B, true)
    const fresh = await insertToken(A, false)
    expect(await app.database.cleanupExpiredRefreshTokens()).toBeGreaterThanOrEqual(2)
    expect([await exists(A, expiredA), await exists(B, expiredB), await exists(A, fresh)]).toEqual([false, false, true])
  })

  it('si otra instancia tiene el lock, no hace nada; el scheduler corre las dos limpiezas', async () => {
    const expired = await insertToken(A, true)
    const holder: pg.Client = await rawTestClient()
    try {
      await holder.query('begin')
      await holder.query(`select pg_advisory_xact_lock(hashtext(current_schema() || ':refresh-tokens-cleanup'))`)
      expect(await app.database.cleanupExpiredRefreshTokens()).toBeNull()
      expect(await exists(A, expired)).toBe(true)
      await holder.query('commit')
    } finally {
      await holder.end()
    }
    const { IdempotencyCleanupService } = await import('../../src/db/idempotency-cleanup.service.ts')
    const result = await app.app.get(IdempotencyCleanupService).runOnce()
    expect(result.refreshTokens).toBeGreaterThanOrEqual(1)
    expect(typeof result.idempotencyKeys).toBe('number')
    expect(await exists(A, expired)).toBe(false)
  })
})

describe('5. prefijo global /api', () => {
  it('las rutas viven bajo /api; sin el prefijo, 404', async () => {
    const server = app.app.getHttpServer()
    expect((await request(server).get('/api/health')).status).toBe(200)
    expect((await request(server).get('/health')).status).toBe(404)
    expect((await request(server).post('/auth/login').send({})).status).toBe(404)
  })

  it('la cookie de refresh va con Path=/api/auth/refresh', async () => {
    const res = await login(app, A.limited.email)
    expect(REFRESH_COOKIE_PATH).toBe('/api/auth/refresh')
    expect(String(res.headers['set-cookie'])).toContain('; Path=/api/auth/refresh;')
  })
})

describe('6. sucursales demo con id fijo (ensureDemoBranches)', () => {
  it('crea, conserva y migra sin duplicar; con el id ocupado por otro código, falla con un mensaje claro', async () => {
    const empresaId = newId()
    const demo = ['CTR', 'NOR'].map(code => ({ id: newId(), name: `Demo ${code}`, code, city: 'Cordoba', address: 'x', status: 'active' as const }))
    const oldId = newId()
    let userId = ''
    const client = await rawTestClient()
    const inTenant = async <T>(fn: () => Promise<T>): Promise<T> => {
      await client.query('begin')
      try {
        await client.query(`select set_config('app.empresa_id', $1, true)`, [empresaId])
        const out = await fn()
        await client.query('commit')
        return out
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    }
    try {
      // Estado de BE-1a: CTR existe con un id aleatorio y un usuario la tiene habilitada.
      userId = await app.database.withTenant(empresaId, async tx => {
        await tx.insert(companies).values({ id: empresaId, name: `demo ${empresaId}`, timezone: 'America/Argentina/Cordoba' })
        await tx.insert(branches).values({ id: oldId, empresaId, name: 'Vieja', code: 'CTR', city: 'c', address: 'a' })
        const user = await insertTestUser(tx, empresaId, 'demo')
        await tx.insert(userBranches).values({ id: newId(), empresaId, userId: user.userId, branchId: oldId })
        return user.userId
      })
      const first = await inTenant(() => ensureDemoBranches(client, empresaId, demo))
      expect(first).toEqual([
        { code: 'CTR', outcome: 'migrated', fromId: oldId },
        { code: 'NOR', outcome: 'created' },
      ])
      const after = await app.database.withTenant(empresaId, async tx => ({
        branches: await tx.select({ id: branches.id, code: branches.code, name: branches.name }).from(branches).orderBy(branches.code),
        enabled: await tx.select({ branchId: userBranches.branchId }).from(userBranches).where(eq(userBranches.userId, userId)),
      }))
      expect(after.branches).toEqual([
        { id: demo[0]?.id, code: 'CTR', name: 'Vieja' },
        { id: demo[1]?.id, code: 'NOR', name: 'Demo NOR' },
      ])
      expect(after.enabled).toEqual([{ branchId: demo[0]?.id }])
      expect(await inTenant(() => ensureDemoBranches(client, empresaId, demo))).toEqual([
        { code: 'CTR', outcome: 'kept' },
        { code: 'NOR', outcome: 'kept' },
      ])
      // El id fijo de CTR pasa a ser, por error, el que ya tiene NOR.
      const clash = [{ id: after.branches[1]?.id ?? '', name: 'Demo CTR', code: 'CTR', city: 'c', address: 'a', status: 'active' as const }]
      const err = await inTenant(() => ensureDemoBranches(client, empresaId, clash)).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(DemoBranchConflictError)
      expect(String(err)).toContain('ya lo usa la sucursal NOR')
    } finally {
      await client.end()
      await removeTestCompany(app.database, { empresaId, userId })
    }
  })
})
