import { eq } from 'drizzle-orm'
import { hashPassword } from '../../src/auth/passwords.ts'
import type { Database, TenantTx } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import {
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
import { pgCode } from './db.ts'

/**
 * Una empresa de prueba y un usuario REAL de esa empresa (desde BE-1a, `user_id` de idempotency_keys y
 * audit_log tiene FK a users: el actor de un test tiene que existir).
 */
export type TestTenant = { empresaId: string; userId: string }

/** Contraseña de todos los usuarios de prueba. */
export const TEST_PASSWORD = 'contraseña-de-prueba-larga'
let testHash: Promise<string> | undefined
/** Un solo hash argon2id para todos los usuarios de prueba (hashear cuesta ~50 ms). */
export function testPasswordHash(): Promise<string> {
  testHash ??= hashPassword(TEST_PASSWORD)
  return testHash
}

/** Un rol sin permisos y un usuario activo con ese rol, sin auditoría (es preparación de datos). */
export async function insertTestUser(tx: TenantTx, empresaId: string, label: string): Promise<{ userId: string; roleId: string; email: string }> {
  const roleId = newId()
  const userId = newId()
  const email = `test-${label}-${userId}@sdgpd.test`.toLowerCase()
  await tx.insert(roles).values({ id: roleId, empresaId, name: `test ${label} ${roleId}` })
  await tx.insert(users).values({ id: userId, empresaId, email, fullName: `Usuario ${label}`, passwordHash: await testPasswordHash(), roleId })
  return { userId, roleId, email }
}

export async function createTestCompany(db: Database, label: string): Promise<TestTenant> {
  const empresaId = newId()
  const { userId } = await db.withTenant(empresaId, async tx => {
    await tx.insert(companies).values({ id: empresaId, name: `test ${label} ${empresaId}`, timezone: 'America/Argentina/Cordoba' })
    return insertTestUser(tx, empresaId, label)
  })
  return { empresaId, userId }
}

/** Otro usuario real en una empresa de prueba existente. */
export async function createTestUser(db: Database, empresaId: string, label: string): Promise<string> {
  return (await db.withTenant(empresaId, tx => insertTestUser(tx, empresaId, label))).userId
}

/**
 * Borra todo lo de la empresa de prueba que se puede borrar. audit_log es append-only y el rol de
 * aplicación no puede borrarlo (por diseño); desde BE-1a sus filas tienen FK a users, así que un
 * usuario auditado (y con él su rol y su empresa) tampoco se puede borrar: queda en sdgpd_test con
 * ids y emails aleatorios, sin afectar a ningún test (todos filtran por su propia empresa).
 */
export async function removeTestCompany(db: Database, tenant: TestTenant | undefined): Promise<void> {
  if (tenant === undefined) return
  const { empresaId } = tenant
  await db.withTenant(empresaId, async tx => {
    // Maestros (BE-2): drivers antes que users (FK del usuario vinculado).
    await tx.delete(drivers).where(eq(drivers.empresaId, empresaId))
    await tx.delete(vehicles).where(eq(vehicles.empresaId, empresaId))
    await tx.delete(suppliers).where(eq(suppliers.empresaId, empresaId))
    await tx.delete(motivos).where(eq(motivos.empresaId, empresaId))
    await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.empresaId, empresaId))
    await tx.delete(documentCounters).where(eq(documentCounters.empresaId, empresaId))
    await tx.delete(refreshTokens).where(eq(refreshTokens.empresaId, empresaId))
    await tx.delete(loginAttempts).where(eq(loginAttempts.empresaId, empresaId))
    await tx.delete(userBranches).where(eq(userBranches.empresaId, empresaId))
    await tx.delete(rolePermissions).where(eq(rolePermissions.empresaId, empresaId))
    await tx.delete(branches).where(eq(branches.empresaId, empresaId))
  })
  try {
    await db.withTenant(empresaId, async tx => {
      await tx.delete(users).where(eq(users.empresaId, empresaId))
      await tx.delete(roles).where(eq(roles.empresaId, empresaId))
      await tx.delete(companies).where(eq(companies.id, empresaId))
    })
  } catch (err) {
    // 23503 foreign_key_violation: hay audit_log de esos usuarios. Quedan, por diseño.
    if (pgCode(err) !== '23503') throw err
  }
}
