// App completa (AppModule, con el AuthGuard real) y datos de identidad para los tests de BE-1a.
import 'reflect-metadata'
import { createHash } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { type INestApplication, type Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ACTIONS, type Action, MODULES, type Module } from '@sdgpd/contracts'
import { eq } from 'drizzle-orm'
import request, { type Response } from 'supertest'
import { AppModule } from '../../src/app.module.ts'
import { apiPath, configureApp } from '../../src/http/api-prefix.ts'
import { Database, type TenantTx } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { auditLog, branches, companies, rolePermissions, roles, userBranches, users } from '../../src/db/schema/index.ts'
import { testConfig } from './db.ts'
import { removeTestCompany, TEST_PASSWORD, testPasswordHash } from './tenants.ts'

export type AuthApp = { app: INestApplication<Server>; database: Database }

export async function createAuthApp(controllers: Type[] = []): Promise<AuthApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testConfig())], controllers }).compile()
  const app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
  configureApp(app)
  await app.init()
  return { app, database: app.get(Database) }
}

/** Todos los permisos de la matriz (el rol Admin). */
export const ALL_PERMISSIONS: { module: Module; action: Action }[] = MODULES.flatMap(module => ACTIONS.map(action => ({ module, action })))

export type FixtureUser = { id: string; email: string; roleId: string }
export type FixtureCompany = {
  empresaId: string
  branchIds: [string, string]
  adminRoleId: string
  limitedRoleId: string
  admin: FixtureUser
  limited: FixtureUser
  inactive: FixtureUser
}

async function insertRole(tx: TenantTx, empresaId: string, name: string, permissions: { module: Module; action: Action }[]): Promise<string> {
  const id = newId()
  await tx.insert(roles).values({ id, empresaId, name })
  for (const p of permissions) await tx.insert(rolePermissions).values({ id: newId(), empresaId, roleId: id, ...p })
  return id
}

async function insertUser(
  tx: TenantTx,
  empresaId: string,
  roleId: string,
  label: string,
  branchIds: string[],
  active = true,
): Promise<FixtureUser> {
  const id = newId()
  const email = `auth-${label}-${id}@sdgpd.test`
  await tx.insert(users).values({ id, empresaId, email, fullName: `Usuario ${label}`, passwordHash: await testPasswordHash(), roleId, active })
  for (const branchId of branchIds) await tx.insert(userBranches).values({ id: newId(), empresaId, userId: id, branchId })
  return { id, email, roleId }
}

/**
 * Una empresa con 2 sucursales, un rol Admin (todo), un rol limitado (solo `inventory.ver`), un admin
 * con las 2 sucursales, un usuario limitado con la primera y un usuario inactivo. Todos con TEST_PASSWORD.
 */
export async function createFixtureCompany(db: Database, label: string): Promise<FixtureCompany> {
  const empresaId = newId()
  return db.withTenant(empresaId, async tx => {
    await tx.insert(companies).values({ id: empresaId, name: `auth ${label} ${empresaId}`, timezone: 'America/Argentina/Cordoba' })
    const branchIds: [string, string] = [newId(), newId()]
    for (const [i, id] of branchIds.entries()) {
      await tx.insert(branches).values({ id, empresaId, name: `Sucursal ${label} ${i + 1}`, code: `${label}-${i + 1}`, city: 'Córdoba', address: 'Calle 1' })
    }
    const adminRoleId = await insertRole(tx, empresaId, 'Admin', ALL_PERMISSIONS)
    const limitedRoleId = await insertRole(tx, empresaId, 'Limitado', [{ module: 'inventory', action: 'ver' }])
    return {
      empresaId,
      branchIds,
      adminRoleId,
      limitedRoleId,
      admin: await insertUser(tx, empresaId, adminRoleId, `${label}-admin`, branchIds),
      limited: await insertUser(tx, empresaId, limitedRoleId, `${label}-limited`, [branchIds[0]]),
      inactive: await insertUser(tx, empresaId, adminRoleId, `${label}-inactive`, branchIds, false),
    }
  })
}

export async function removeFixtureCompany(db: Database, company: FixtureCompany | undefined): Promise<void> {
  if (company === undefined) return
  await removeTestCompany(db, { empresaId: company.empresaId, userId: company.admin.id })
}

/** Lee un campo de un usuario (para verificar efectos), con el tenant de su empresa. */
export async function userRow(db: Database, empresaId: string, userId: string) {
  const rows = await db.withTenant(empresaId, tx => tx.select().from(users).where(eq(users.id, userId)))
  return rows[0]
}

// --- Registro de respuestas (V4: ningún cuerpo de respuesta lleva hashes ni tokens) ---

/** Cuerpos de respuesta de los tests de endpoints. Si V4_DUMP apunta a un archivo, también se escriben ahí. */
export const responseBodies: string[] = []

export function recorded(res: Response): Response {
  const text = res.text ?? ''
  responseBodies.push(text)
  const dump = process.env.V4_DUMP
  if (dump) appendFileSync(dump, `${res.status} ${text}\n`)
  return res
}

/** Todo refresh token que emitió el servidor en estos tests (para buscarlos en los cuerpos, V4). */
export const issuedRefreshTokens = new Set<string>()

/** El refresh token de un Set-Cookie (o undefined). */
export function refreshFrom(res: Response): string | undefined {
  const header: unknown = res.headers['set-cookie']
  const cookies = Array.isArray(header) ? header.filter((h): h is string => typeof h === 'string') : []
  for (const c of cookies) {
    const match = /^sdgpd_refresh=([^;]*)/.exec(c)
    if (match?.[1] !== undefined && match[1] !== '') {
      issuedRefreshTokens.add(match[1])
      return match[1]
    }
  }
  return undefined
}

/** Hashes SHA-256 (hex) de los refresh tokens emitidos: lo que se guarda en refresh_tokens.token_hash. */
function issuedTokenHashes(): string[] {
  return [...issuedRefreshTokens].map(t => createHash('sha256').update(t, 'utf8').digest('hex'))
}

/**
 * V4 sobre audit_log: filas de esas empresas cuyo before/after tiene un hash argon2, una columna secreta,
 * un refresh token emitido o su hash. audit_log solo se lee con tenant (RLS), así que se recorre por empresa.
 */
export async function auditRowsWithSecrets(db: Database, empresaIds: string[]): Promise<{ total: number; offenders: string[] }> {
  const needles = [...issuedRefreshTokens, ...issuedTokenHashes()]
  let total = 0
  const offenders: string[] = []
  for (const empresaId of empresaIds) {
    const rows = await db.withTenant(empresaId, tx => tx.select({ before: auditLog.before, after: auditLog.after }).from(auditLog))
    total += rows.length
    for (const row of rows) {
      const text = JSON.stringify(row)
      if (/\$argon2|password_?hash|token_?hash/i.test(text) || needles.some(n => text.includes(n))) offenders.push(text)
    }
  }
  return { total, offenders }
}

/** V4: cuerpos de respuesta con un hash argon2, un nombre de columna secreta o un refresh token emitido. */
export function bodiesWithSecrets(): string[] {
  return responseBodies.filter(
    body => /\$argon2|password_?hash|token_?hash/i.test(body) || [...issuedRefreshTokens].some(token => body.includes(token)),
  )
}

export type LoggedIn = { accessToken: string; refreshToken: string; res: Response }

export async function login(app: AuthApp, email: string, password = TEST_PASSWORD): Promise<Response> {
  return recorded(await request(app.app.getHttpServer()).post('/api/auth/login').send({ email, password, clientType: 'web' }))
}

export async function loginOk(app: AuthApp, email: string): Promise<LoggedIn> {
  const res = await login(app, email)
  if (res.status !== 200) throw new Error(`login de ${email} falló: ${res.status} ${res.text}`)
  const refreshToken = refreshFrom(res)
  const body: unknown = res.body
  if (refreshToken === undefined || typeof body !== 'object' || body === null || !('accessToken' in body) || typeof body.accessToken !== 'string') {
    throw new Error('login sin cookie o sin accessToken')
  }
  return { accessToken: body.accessToken, refreshToken, res }
}

export async function refresh(app: AuthApp, refreshToken: string | undefined, withHeader = true): Promise<Response> {
  let req = request(app.app.getHttpServer()).post('/api/auth/refresh')
  if (withHeader) req = req.set('X-Requested-With', 'XMLHttpRequest')
  if (refreshToken !== undefined) req = req.set('Cookie', `sdgpd_refresh=${refreshToken}`)
  return recorded(await req.send())
}

export async function get(app: AuthApp, path: string, accessToken?: string): Promise<Response> {
  const req = request(app.app.getHttpServer()).get(apiPath(path))
  return recorded(await (accessToken === undefined ? req : req.set('Authorization', `Bearer ${accessToken}`)))
}

export async function send(
  app: AuthApp,
  method: 'post' | 'put',
  path: string,
  accessToken: string,
  body: object,
): Promise<Response> {
  const req = request(app.app.getHttpServer())[method](apiPath(path)).set('Authorization', `Bearer ${accessToken}`)
  return recorded(await (method === 'post' ? req.set('Idempotency-Key', newId()) : req).send(body))
}
