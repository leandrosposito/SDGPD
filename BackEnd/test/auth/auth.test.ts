// Login, refresh, logout y access token (ADR-BE-003 §Decisión 1-3, sub-decisiones 1-4; BE-1a),
// por HTTP contra la app completa con el AuthGuard real.
import { accessTokenResponseSchema, errorBodySchema, loginResponseSchema, sessionSchema, userPageSchema } from '@sdgpd/contracts'
import { eq, sql } from 'drizzle-orm'
import { SignJWT, UnsecuredJWT } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LOGIN_MAX_FAILURES } from '../../src/db/auth-store.ts'
import { newId } from '../../src/db/ids.ts'
import { loginAttempts, refreshTokens } from '../../src/db/schema/index.ts'
import { testConfig } from '../support/db.ts'
import {
  type AuthApp,
  createAuthApp,
  createFixtureCompany,
  type FixtureCompany,
  get,
  login,
  loginOk,
  recorded,
  refresh,
  refreshFrom,
  removeFixtureCompany,
  auditRowsWithSecrets,
  bodiesWithSecrets,
  issuedRefreshTokens,
  responseBodies,
  send,
} from '../support/auth-app.ts'

let app: AuthApp
let A: FixtureCompany
let B: FixtureCompany

beforeAll(async () => {
  app = await createAuthApp()
  A = await createFixtureCompany(app.database, 'aa')
  B = await createFixtureCompany(app.database, 'ab')
})

afterAll(async () => {
  try {
    await removeFixtureCompany(app.database, A)
    await removeFixtureCompany(app.database, B)
  } finally {
    await app?.app.close()
  }
})

const KEY = testConfig().auth.jwtSecret

/** Un access token armado a mano: con la clave dada, los claims dados y el vencimiento dado. */
async function forge(key: Uint8Array, claims: { sub: string; emp: string; rol: string; ver: number }, expiresAt: number) {
  return new SignJWT({ emp: claims.emp, rol: claims.rol, ver: claims.ver, sid: newId() })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer('sdgpd')
    .setAudience('sdgpd-api')
    .setIssuedAt(expiresAt - 900)
    .setExpirationTime(expiresAt)
    .sign(key)
}

const now = () => Math.floor(Date.now() / 1000)

describe('POST /auth/login', () => {
  it('éxito: access token, sesión completa y refresh SOLO en la cookie HttpOnly/Secure/SameSite=Strict/Path=/auth/refresh', async () => {
    const res = await login(app, A.admin.email)
    expect(res.status).toBe(200)
    const body = loginResponseSchema.parse(res.body)
    expect(body.tokenType).toBe('Bearer')
    expect([body.session.user.id, body.session.user.email]).toEqual([A.admin.id, A.admin.email])
    expect(body.session.company.id).toBe(A.empresaId)
    expect(body.session.role).toEqual({ id: A.adminRoleId, name: 'Admin' })
    expect(body.session.permissions).toHaveLength(70)
    expect(body.session.branches.map(b => b.id).sort()).toEqual([...A.branchIds].sort())
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/^sdgpd_refresh=[A-Za-z0-9_-]{43}; Path=\/auth\/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/)
    const token = refreshFrom(res)
    expect(token).toBeDefined()
    expect(res.text).not.toContain(token)
  })

  it('el email se normaliza (espacios y mayúsculas)', async () => {
    expect((await login(app, `  ${A.admin.email.toUpperCase()} `)).status).toBe(200)
  })

  it('contraseña mal, email inexistente y usuario inactivo: el MISMO 401 invalid-credentials', async () => {
    const wrong = await login(app, A.limited.email, 'otra-contraseña-cualquiera')
    const missing = await login(app, `nadie-${newId()}@sdgpd.test`)
    const inactive = await login(app, A.inactive.email)
    for (const res of [wrong, missing, inactive]) {
      expect(res.status).toBe(401)
      expect(res.headers['set-cookie']).toBeUndefined()
    }
    expect(errorBodySchema.parse(wrong.body)).toEqual({ code: 'invalid-credentials', message: 'Email o contraseña incorrectos' })
    expect(missing.body).toEqual(wrong.body)
    expect(inactive.body).toEqual(wrong.body)
  })

  it(`bloqueo: después de ${LOGIN_MAX_FAILURES} fallos, ni la contraseña correcta entra (y responde igual); al vencer, entra`, async () => {
    const victim = B.limited
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) expect((await login(app, victim.email, `mal-${i}-xxxxxxxx`)).status).toBe(401)
    const blocked = await login(app, victim.email)
    expect(blocked.status).toBe(401)
    expect(blocked.body).toEqual({ code: 'invalid-credentials', message: 'Email o contraseña incorrectos' })
    const state = await app.database.withTenant(B.empresaId, tx =>
      tx.select({ lockedUntil: loginAttempts.lockedUntil }).from(loginAttempts).where(eq(loginAttempts.userId, victim.id)),
    )
    expect(state[0]?.lockedUntil).not.toBeNull()
    // Se simula el paso del tiempo: el bloqueo vence.
    await app.database.withTenant(B.empresaId, tx =>
      tx.update(loginAttempts).set({ lockedUntil: sql`now() - interval '1 second'` }).where(eq(loginAttempts.userId, victim.id)),
    )
    expect((await login(app, victim.email)).status).toBe(200)
    const after = await app.database.withTenant(B.empresaId, tx => tx.select().from(loginAttempts).where(eq(loginAttempts.userId, victim.id)))
    expect(after).toEqual([])
  })

  it('un email inexistente no se bloquea ni responde distinto, por más intentos que haya', async () => {
    const email = `nadie-${newId()}@sdgpd.test`
    for (let i = 0; i <= LOGIN_MAX_FAILURES; i++) {
      const res = await login(app, email)
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ code: 'invalid-credentials', message: 'Email o contraseña incorrectos' })
    }
  })

  it('clientType native: 501 not-implemented (la rama queda en el contrato)', async () => {
    const res = recorded(
      await request(app.app.getHttpServer()).post('/auth/login').send({ email: A.admin.email, password: 'x', clientType: 'native' }),
    )
    expect(res.status).toBe(501)
    expect(errorBodySchema.parse(res.body).code).toBe('not-implemented')
  })

  it('un body inválido es 400 validation-error (y no exige Idempotency-Key: /auth/* está exento)', async () => {
    const res = recorded(await request(app.app.getHttpServer()).post('/auth/login').send({ email: 'no-es-email', password: 'x' }))
    expect(res.status).toBe(400)
    expect(errorBodySchema.parse(res.body).code).toBe('validation-error')
  })
})

describe('POST /auth/refresh', () => {
  it('rota: devuelve un access token nuevo y una cookie nueva; el refresh viejo ya no sirve', async () => {
    const first = await loginOk(app, A.admin.email)
    const rotated = await refresh(app, first.refreshToken)
    expect(rotated.status).toBe(200)
    const body = accessTokenResponseSchema.parse(rotated.body)
    const next = refreshFrom(rotated)
    expect(next).toBeDefined()
    expect(next).not.toBe(first.refreshToken)
    expect(rotated.text).not.toContain(next)
    expect((await get(app, '/auth/session', body.accessToken)).status).toBe(200)
    expect((await refresh(app, next)).status).toBe(200)
  })

  it('reusar un refresh ya usado revoca la familia entera: tampoco sirve el último emitido', async () => {
    const first = await loginOk(app, A.admin.email)
    const rotated = await refresh(app, first.refreshToken)
    const latest = refreshFrom(rotated)
    expect(rotated.status).toBe(200)
    const reuse = await refresh(app, first.refreshToken)
    expect(reuse.status).toBe(401)
    expect(String(reuse.headers['set-cookie'])).toMatch(/^sdgpd_refresh=; .*Max-Age=0$/)
    expect((await refresh(app, latest)).status).toBe(401)
    const family = await app.database.withTenant(A.empresaId, tx =>
      tx.select({ revokedAt: refreshTokens.revokedAt }).from(refreshTokens).where(eq(refreshTokens.userId, A.admin.id)),
    )
    expect(family.length).toBeGreaterThanOrEqual(2)
  })

  it('sin X-Requested-With: 403 csrf-header-required, y el token no se consume', async () => {
    const session = await loginOk(app, A.admin.email)
    const res = await refresh(app, session.refreshToken, false)
    expect(res.status).toBe(403)
    expect(errorBodySchema.parse(res.body).code).toBe('csrf-header-required')
    expect((await refresh(app, session.refreshToken)).status).toBe(200)
  })

  it('sin cookie o con un token desconocido: 401', async () => {
    expect((await refresh(app, undefined)).status).toBe(401)
    expect((await refresh(app, 'x'.repeat(43))).status).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('con el access token: revoca la familia y borra la cookie; el refresh deja de servir', async () => {
    const session = await loginOk(app, A.admin.email)
    const res = recorded(
      await request(app.app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${session.accessToken}`).send(),
    )
    expect(res.status).toBe(204)
    expect(String(res.headers['set-cookie'])).toMatch(/^sdgpd_refresh=; Path=\/auth\/refresh; .*Max-Age=0$/)
    expect((await refresh(app, session.refreshToken)).status).toBe(401)
  })

  it('con la cookie: revoca su familia', async () => {
    const session = await loginOk(app, A.admin.email)
    const res = recorded(await request(app.app.getHttpServer()).post('/auth/logout').set('Cookie', `sdgpd_refresh=${session.refreshToken}`).send())
    expect(res.status).toBe(204)
    expect((await refresh(app, session.refreshToken)).status).toBe(401)
  })

  it('sin nada: 204 igual (se puede repetir sin efecto)', async () => {
    expect(recorded(await request(app.app.getHttpServer()).post('/auth/logout').send()).status).toBe(204)
  })
})

describe('access token', () => {
  it('GET /auth/session con token: la sesión; sin token: 401 unauthenticated', async () => {
    const session = await loginOk(app, A.limited.email)
    const ok = await get(app, '/auth/session', session.accessToken)
    expect(ok.status).toBe(200)
    expect(sessionSchema.parse(ok.body).permissions).toEqual([{ module: 'inventory', action: 'ver' }])
    expect(sessionSchema.parse(ok.body).branches.map(b => b.id)).toEqual([A.branchIds[0]])
    const missing = await get(app, '/auth/session')
    expect(missing.status).toBe(401)
    expect(errorBodySchema.parse(missing.body).code).toBe('unauthenticated')
  })

  it('V1: firmado con otra clave, con alg none, con emp de B y sub de A (clave correcta) y vencido: los cuatro 401', async () => {
    const claims = { sub: A.admin.id, emp: A.empresaId, rol: A.adminRoleId, ver: 1 }
    const otherKey = new Uint8Array(32).fill(1)
    const forged = {
      otraClave: await forge(otherKey, claims, now() + 600),
      algNone: new UnsecuredJWT({ emp: claims.emp, rol: claims.rol, ver: 1, sid: newId() })
        .setSubject(claims.sub)
        .setIssuer('sdgpd')
        .setAudience('sdgpd-api')
        .setIssuedAt()
        .setExpirationTime(now() + 600)
        .encode(),
      empresaCruzada: await forge(KEY, { ...claims, emp: B.empresaId }, now() + 600),
      vencido: await forge(KEY, claims, now() - 5),
    }
    // Control: el mismo token bien armado pasa (si no, los 401 de abajo no probarían nada).
    expect((await get(app, '/auth/session', await forge(KEY, claims, now() + 600))).status).toBe(200)
    const statuses: Record<string, number> = {}
    for (const [name, token] of Object.entries(forged)) statuses[name] = (await get(app, '/auth/session', token)).status
    expect(statuses).toEqual({ otraClave: 401, algNone: 401, empresaCruzada: 401, vencido: 401 })
  })

  it('desactivar al usuario: su access token deja de valer y sus refresh tokens quedan revocados', async () => {
    const admin = await loginOk(app, B.admin.email)
    const victim = await loginOk(app, B.limited.email)
    const user = await get(app, `/users?roleId=${B.limitedRoleId}`, admin.accessToken)
    const current = userPageSchema.parse(user.body).items.find(u => u.id === B.limited.id)
    expect(current).toBeDefined()
    const res = await send(app, 'put', `/users/${B.limited.id}`, admin.accessToken, {
      fullName: 'Desactivado',
      roleId: B.limitedRoleId,
      active: false,
      branchIds: [B.branchIds[0]],
      version: current?.version,
    })
    expect(res.status).toBe(200)
    expect((await get(app, '/auth/session', victim.accessToken)).status).toBe(401)
    expect((await refresh(app, victim.refreshToken)).status).toBe(401)
    const tokens = await app.database.withTenant(B.empresaId, tx =>
      tx.select({ revokedAt: refreshTokens.revokedAt }).from(refreshTokens).where(eq(refreshTokens.userId, B.limited.id)),
    )
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.every(t => t.revokedAt !== null)).toBe(true)
  })
})

describe('V4: secretos en las respuestas de esta suite', () => {
  it('audit_log de las empresas de la suite: ninguna fila con un hash, una columna secreta o un token', async () => {
    const { total, offenders } = await auditRowsWithSecrets(app.database, [A.empresaId, B.empresaId])
    expect(total).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })

  it('ningún cuerpo de respuesta tiene un hash argon2, una columna secreta ni un refresh token emitido', () => {
    expect(responseBodies.length).toBeGreaterThan(20)
    expect(issuedRefreshTokens.size).toBeGreaterThan(10)
    expect(bodiesWithSecrets()).toEqual([])
  })
})
