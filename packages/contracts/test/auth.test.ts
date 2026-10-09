import { describe, expect, it } from 'vitest'
import {
  ACTIONS,
  authErrorCodes,
  createUserRequestSchema,
  loginRequestSchema,
  MODULES,
  PASSWORD_MIN_LENGTH,
  sessionSchema,
  updateRolePermissionsRequestSchema,
  updateUserRequestSchema,
  userErrorCodes,
  userListQuerySchema,
  userSchema,
} from '../src/index.ts'

const ID = '01a121ca-8df0-7552-9004-881c8ee2a687'

describe('matriz de permisos (ADR-BE-003, sub-decisión 6)', () => {
  it('10 módulos (los de FrontEnd/src/modules) y 7 acciones', () => {
    expect(MODULES).toEqual(['analytics', 'cash', 'clients', 'compras', 'dashboard', 'inventory', 'logistics', 'orders', 'settings', 'suppliers'])
    expect(ACTIONS).toEqual(['ver', 'crear', 'editar', 'anular', 'aprobar', 'exportar', 'forzar'])
  })

  it('PUT /roles/{id}/permissions: rechaza un módulo o una acción fuera de la matriz, y exige version', () => {
    const ok = { permissions: [{ module: 'settings', action: 'ver' }], version: 1 }
    expect(updateRolePermissionsRequestSchema.safeParse(ok).success).toBe(true)
    expect(updateRolePermissionsRequestSchema.safeParse({ ...ok, permissions: [{ module: 'pedidos', action: 'ver' }] }).success).toBe(false)
    expect(updateRolePermissionsRequestSchema.safeParse({ ...ok, permissions: [{ module: 'orders', action: 'borrar' }] }).success).toBe(false)
    expect(updateRolePermissionsRequestSchema.safeParse({ permissions: [] }).success).toBe(false)
  })
})

describe('login', () => {
  it('normaliza el email y exige clientType web|native; no acepta campos de más', () => {
    expect(loginRequestSchema.parse({ email: '  Ana@Example.COM ', password: 'x', clientType: 'web' })).toEqual({
      email: 'ana@example.com',
      password: 'x',
      clientType: 'web',
    })
    expect(loginRequestSchema.safeParse({ email: 'ana@example.com', password: 'x' }).success).toBe(false)
    expect(loginRequestSchema.safeParse({ email: 'ana@example.com', password: 'x', clientType: 'desktop' }).success).toBe(false)
    expect(loginRequestSchema.safeParse({ email: 'ana@example.com', password: 'x', clientType: 'web', empresaId: ID }).success).toBe(false)
  })

  it('códigos con su status', () => {
    expect(authErrorCodes).toEqual({ 'invalid-credentials': 401, 'csrf-header-required': 403, 'branch-not-enabled': 403, 'not-implemented': 501 })
    expect(userErrorCodes).toEqual({ 'email-in-use': 409, 'role-not-found': 422, 'branch-not-found': 422 })
  })
})

describe('usuarios', () => {
  it(`alta: contraseña de al menos ${PASSWORD_MIN_LENGTH} caracteres, active por defecto, sin empresaId`, () => {
    const base = { email: 'a@b.com', fullName: 'A', password: 'x'.repeat(PASSWORD_MIN_LENGTH), roleId: ID, branchIds: [] }
    expect(createUserRequestSchema.parse(base).active).toBe(true)
    expect(createUserRequestSchema.safeParse({ ...base, password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1) }).success).toBe(false)
    expect(createUserRequestSchema.safeParse({ ...base, empresaId: ID }).success).toBe(false)
  })

  it('edición: exige version y no deja cambiar el email', () => {
    const base = { fullName: 'A', roleId: ID, active: true, branchIds: [ID], version: 3 }
    expect(updateUserRequestSchema.safeParse(base).success).toBe(true)
    expect(updateUserRequestSchema.safeParse({ ...base, version: undefined }).success).toBe(false)
    expect(updateUserRequestSchema.safeParse({ ...base, email: 'otro@b.com' }).success).toBe(false)
  })

  it('la respuesta no admite el hash de la contraseña', () => {
    const user = { id: ID, email: 'a@b.com', fullName: 'A', roleId: ID, active: true, branchIds: [], version: 1, createdAt: '2026-10-09T12:00:00.000Z' }
    expect(userSchema.safeParse(user).success).toBe(true)
    expect(userSchema.safeParse({ ...user, passwordHash: '$argon2id$x' }).success).toBe(false)
  })

  it('GET /users: el filtro active llega como texto de la query y sale booleano', () => {
    expect(userListQuerySchema.parse({ active: 'false' })).toMatchObject({ active: false })
    expect(userListQuerySchema.safeParse({ active: 'no' }).success).toBe(false)
  })
})

describe('sesión', () => {
  it('no admite campos de más (ni empresaId ni tokens)', () => {
    const session = {
      user: { id: ID, email: 'a@b.com', fullName: 'A' },
      company: { id: ID, name: 'E', timezone: 'America/Argentina/Cordoba' },
      role: { id: ID, name: 'Admin' },
      permissions: [{ module: 'orders', action: 'ver' }],
      branches: [],
    }
    expect(sessionSchema.safeParse(session).success).toBe(true)
    expect(sessionSchema.safeParse({ ...session, refreshToken: 'x' }).success).toBe(false)
  })
})
