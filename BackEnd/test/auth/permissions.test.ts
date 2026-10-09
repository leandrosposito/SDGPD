// Guard de permisos, sucursal habilitada, gestión de usuarios y roles, aislamiento entre empresas por
// los endpoints, y verificación de arranque (ADR-BE-002 §Decisión 3; ADR-BE-003 §Decisión 4,
// sub-decisión 6; BE-1a). Por HTTP contra la app completa con el AuthGuard real.
import 'reflect-metadata'
import type { Server } from 'node:http'
import { Controller, Get, type INestApplication, Query } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  accessTokenResponseSchema,
  branchPageSchema,
  errorBodySchema,
  type Permission,
  rolePageSchema,
  roleSchema,
  userPageSchema,
  userSchema,
} from '@sdgpd/contracts'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module.ts'
import { configureApp } from '../../src/http/api-prefix.ts'
import { Public, RequirePermission } from '../../src/auth/route-policy.ts'
import { newId } from '../../src/db/ids.ts'
import { auditLog } from '../../src/db/schema/index.ts'
import { testConfig } from '../support/db.ts'
import {
  ALL_PERMISSIONS,
  type AuthApp,
  auditRowsWithSecrets,
  bodiesWithSecrets,
  createAuthApp,
  createFixtureCompany,
  type FixtureCompany,
  get,
  login,
  loginOk,
  refresh,
  removeFixtureCompany,
  responseBodies,
  send,
  userRow,
} from '../support/auth-app.ts'
import { TEST_PASSWORD } from '../support/tenants.ts'

/** Una ruta de prueba con `branchId` en la query y permiso declarado (inventory.ver). */
@Controller('probe-branch')
class BranchProbeController {
  @Get()
  @RequirePermission('inventory', 'ver')
  get(@Query('branchId') branchId: string) {
    return { branchId }
  }
}

let app: AuthApp
let A: FixtureCompany
let B: FixtureCompany

beforeAll(async () => {
  app = await createAuthApp([BranchProbeController])
  A = await createFixtureCompany(app.database, 'pa')
  B = await createFixtureCompany(app.database, 'pb')
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
  const res = await get(app, '/roles?pageSize=100', token)
  expect(res.status).toBe(200)
  return rolePageSchema.parse(res.body).items.find(r => r.id === roleId)
}

describe('permisos por endpoint', () => {
  it('sin el permiso: 403 forbidden; con el permiso: 200', async () => {
    const limited = await loginOk(app, A.limited.email)
    const admin = await loginOk(app, A.admin.email)
    const denied = await get(app, '/users', limited.accessToken)
    expect(denied.status).toBe(403)
    expect(errorBodySchema.parse(denied.body)).toMatchObject({ code: 'forbidden', details: { module: 'settings', action: 'ver' } })
    const allowed = await get(app, '/users', admin.accessToken)
    expect(allowed.status).toBe(200)
    const page = userPageSchema.parse(allowed.body)
    expect(page.items.map(u => u.id).sort()).toEqual([A.admin.id, A.inactive.id, A.limited.id].sort())
  })

  it('cambiar la matriz del rol invalida los access tokens viejos; el refresh emite uno con los permisos nuevos', async () => {
    const admin = await loginOk(app, A.admin.email)
    const limited = await loginOk(app, A.limited.email)
    const before = await roleOf(admin.accessToken, A.limitedRoleId)
    const permissions: Permission[] = [...(before?.permissions ?? []), { module: 'settings', action: 'ver' }]
    const res = await send(app, 'put', `/roles/${A.limitedRoleId}/permissions`, admin.accessToken, { permissions, version: before?.version })
    expect(res.status).toBe(200)
    const role = roleSchema.parse(res.body)
    expect(role.version).toBe((before?.version ?? 0) + 1)
    expect(role.permissions).toContainEqual({ module: 'settings', action: 'ver' })
    // El token emitido antes del cambio ya no vale (ver ≠ permissions_version)…
    expect((await get(app, '/auth/session', limited.accessToken)).status).toBe(401)
    // …y el refresh trae uno con el permiso nuevo.
    const rotated = await refresh(app, limited.refreshToken)
    expect(rotated.status).toBe(200)
    const fresh = accessTokenResponseSchema.parse(rotated.body).accessToken
    expect((await get(app, '/users', fresh)).status).toBe(200)
    // La versión vieja del rol: 409.
    const stale = await send(app, 'put', `/roles/${A.limitedRoleId}/permissions`, admin.accessToken, { permissions, version: before?.version })
    expect(stale.status).toBe(409)
    expect(errorBodySchema.parse(stale.body).code).toBe('version-conflict')
  })

  it('branchId de una sucursal no habilitada: 403 branch-not-enabled; habilitada: 200', async () => {
    const limited = await loginOk(app, B.limited.email)
    const ok = await get(app, `/probe-branch?branchId=${B.branchIds[0]}`, limited.accessToken)
    expect(ok.status).toBe(200)
    const denied = await get(app, `/probe-branch?branchId=${B.branchIds[1]}`, limited.accessToken)
    expect(denied.status).toBe(403)
    expect(errorBodySchema.parse(denied.body).code).toBe('branch-not-enabled')
    const foreign = await get(app, `/probe-branch?branchId=${A.branchIds[0]}`, limited.accessToken)
    expect(foreign.status).toBe(403)
  })

  it('GET /branches: con settings.ver todas las de la empresa; sin él, solo las habilitadas', async () => {
    const admin = await loginOk(app, B.admin.email)
    const limited = await loginOk(app, B.limited.email)
    const all = branchPageSchema.parse((await get(app, '/branches', admin.accessToken)).body)
    expect(all.items.map(b => b.id).sort()).toEqual([...B.branchIds].sort())
    const own = branchPageSchema.parse((await get(app, '/branches', limited.accessToken)).body)
    expect(own.items.map(b => b.id)).toEqual([B.branchIds[0]])
  })
})

describe('usuarios', () => {
  it('POST /users: alta con contraseña inicial; la respuesta y la auditoría no llevan el hash; el usuario entra', async () => {
    const admin = await loginOk(app, A.admin.email)
    const email = `alta-${newId()}@sdgpd.test`
    const res = await send(app, 'post', '/users', admin.accessToken, {
      email: `  ${email.toUpperCase()} `,
      fullName: 'Alta Nueva',
      password: 'una-contraseña-inicial',
      roleId: A.limitedRoleId,
      branchIds: [A.branchIds[1]],
    })
    expect(res.status).toBe(201)
    const user = userSchema.parse(res.body)
    expect(user).toMatchObject({ email, fullName: 'Alta Nueva', roleId: A.limitedRoleId, active: true, branchIds: [A.branchIds[1]], version: 1 })
    expect((await userRow(app.database, A.empresaId, user.id))?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    const audit = await app.database.withTenant(A.empresaId, tx =>
      tx.select().from(auditLog).where(and(eq(auditLog.entity, 'user'), eq(auditLog.entityId, user.id))),
    )
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit)).not.toMatch(/argon2|password/)
    expect((await login(app, email, 'una-contraseña-inicial')).status).toBe(200)
  })

  it('POST /users: email repetido (aunque sea de otra empresa) 409 email-in-use; contraseña corta 400', async () => {
    const admin = await loginOk(app, A.admin.email)
    const base = { fullName: 'X', password: 'una-contraseña-inicial', roleId: A.limitedRoleId, branchIds: [] }
    const dup = await send(app, 'post', '/users', admin.accessToken, { ...base, email: B.admin.email })
    expect(dup.status).toBe(409)
    expect(errorBodySchema.parse(dup.body).code).toBe('email-in-use')
    const short = await send(app, 'post', '/users', admin.accessToken, { ...base, email: `c-${newId()}@sdgpd.test`, password: 'corta' })
    expect(short.status).toBe(400)
  })

  it('PUT /users: cambiar el rol sube permissions_version e invalida el token del usuario; versión vieja 409', async () => {
    const admin = await loginOk(app, B.admin.email)
    const target = await loginOk(app, B.inactive.email).catch(() => undefined)
    expect(target).toBeUndefined() // inactivo: no entra
    const page = userPageSchema.parse((await get(app, '/users?active=true', admin.accessToken)).body)
    expect(page.items.every(u => u.active)).toBe(true)
    const adminRow = page.items.find(u => u.id === B.admin.id)
    // Un usuario nuevo con el rol limitado, para cambiarle el rol.
    const email = `rol-${newId()}@sdgpd.test`
    const created = userSchema.parse(
      (await send(app, 'post', '/users', admin.accessToken, { email, fullName: 'Cambia Rol', password: TEST_PASSWORD, roleId: B.limitedRoleId, branchIds: [] }))
        .body,
    )
    const session = await loginOk(app, email)
    const before = (await userRow(app.database, B.empresaId, created.id))?.permissionsVersion
    const res = await send(app, 'put', `/users/${created.id}`, admin.accessToken, {
      fullName: 'Cambia Rol',
      roleId: B.adminRoleId,
      active: true,
      branchIds: [B.branchIds[0], B.branchIds[1]],
      version: created.version,
    })
    expect(res.status).toBe(200)
    expect(userSchema.parse(res.body)).toMatchObject({ roleId: B.adminRoleId, version: 2, branchIds: [...B.branchIds].sort() })
    expect((await userRow(app.database, B.empresaId, created.id))?.permissionsVersion).toBe((before ?? 0) + 1)
    expect((await get(app, '/auth/session', session.accessToken)).status).toBe(401)
    const stale = await send(app, 'put', `/users/${created.id}`, admin.accessToken, {
      fullName: 'Otra',
      roleId: B.adminRoleId,
      active: true,
      branchIds: [],
      version: created.version,
    })
    expect(stale.status).toBe(409)
    expect(adminRow).toBeDefined()
  })
})

describe('aislamiento por los endpoints', () => {
  it('un usuario de A no ve ni modifica nada de B', async () => {
    const admin = await loginOk(app, A.admin.email)
    const users = userPageSchema.parse((await get(app, '/users?pageSize=100', admin.accessToken)).body)
    const roles = rolePageSchema.parse((await get(app, '/roles?pageSize=100', admin.accessToken)).body)
    const branches = branchPageSchema.parse((await get(app, '/branches?pageSize=100', admin.accessToken)).body)
    const idsOfB = [B.admin.id, B.limited.id, B.inactive.id, B.adminRoleId, B.limitedRoleId, ...B.branchIds]
    const seen = [...users.items.map(u => u.id), ...roles.items.map(r => r.id), ...branches.items.map(b => b.id)]
    expect(seen.filter(id => idsOfB.includes(id))).toEqual([])
    expect(seen.length).toBeGreaterThan(5)

    const putUser = await send(app, 'put', `/users/${B.limited.id}`, admin.accessToken, {
      fullName: 'Intruso',
      roleId: A.limitedRoleId,
      active: false,
      branchIds: [],
      version: 1,
    })
    expect(putUser.status).toBe(404)
    const putRole = await send(app, 'put', `/roles/${B.adminRoleId}/permissions`, admin.accessToken, { permissions: [], version: 1 })
    expect(putRole.status).toBe(404)
    const foreignRole = await send(app, 'post', '/users', admin.accessToken, {
      email: `x-${newId()}@sdgpd.test`,
      fullName: 'X',
      password: TEST_PASSWORD,
      roleId: B.adminRoleId,
      branchIds: [],
    })
    expect(errorBodySchema.parse(foreignRole.body).code).toBe('role-not-found')
    const foreignBranch = await send(app, 'post', '/users', admin.accessToken, {
      email: `x-${newId()}@sdgpd.test`,
      fullName: 'X',
      password: TEST_PASSWORD,
      roleId: A.limitedRoleId,
      branchIds: [B.branchIds[0]],
    })
    expect(errorBodySchema.parse(foreignBranch.body).code).toBe('branch-not-found')

    // Nada de B cambió.
    expect(await userRow(app.database, B.empresaId, B.limited.id)).toMatchObject({ active: true, version: 1 })
    const adminB = await loginOk(app, B.admin.email)
    expect((await roleOf(adminB.accessToken, B.adminRoleId))?.permissions).toHaveLength(ALL_PERMISSIONS.length)
  })
})

describe('verificación de arranque', () => {
  async function boot(controller: new () => object): Promise<unknown> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testConfig())], controllers: [controller] }).compile()
    const nest = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
    configureApp(nest)
    try {
      await nest.init()
      return undefined
    } catch (err) {
      return err
    } finally {
      await nest.close().catch(() => undefined)
    }
  }

  it('un controller con una ruta sin permiso declarado hace fallar el bootstrap', async () => {
    @Controller('sin-permiso')
    class UndeclaredController {
      @Get()
      list() {
        return []
      }
    }
    const err = await boot(UndeclaredController)
    expect(err).toBeInstanceOf(Error)
    expect(String(err)).toContain('GET /api/sin-permiso (UndeclaredController.list) no declara permiso')
  })

  it('@Public() en una ruta que no es de las públicas también hace fallar el bootstrap', async () => {
    @Controller('falsa-publica')
    class FakePublicController {
      @Get()
      @Public()
      list() {
        return []
      }
    }
    expect(String(await boot(FakePublicController))).toContain('GET /api/falsa-publica está marcada @Public()')
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
    expect(bodiesWithSecrets()).toEqual([])
  })
})
