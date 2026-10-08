import { eq } from 'drizzle-orm'
import type { Database } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { branches, companies, documentCounters, idempotencyKeys } from '../../src/db/schema/index.ts'

/** Una empresa de prueba y un usuario (todavía sin tabla de usuarios: BE-1). */
export type TestTenant = { empresaId: string; userId: string }

export async function createTestCompany(db: Database, label: string): Promise<TestTenant> {
  const empresaId = newId()
  await db.withTenant(empresaId, tx =>
    tx.insert(companies).values({ id: empresaId, name: `test ${label} ${empresaId}`, timezone: 'America/Argentina/Cordoba' }),
  )
  return { empresaId, userId: newId() }
}

/**
 * Borra todo lo de la empresa de prueba, salvo audit_log: es append-only y el rol de aplicación no
 * puede borrarlo (por diseño). Sus filas quedan en sdgpd_test, con ids de empresa aleatorios, y no
 * afectan a ningún test (todos filtran por su propia empresa).
 */
export async function removeTestCompany(db: Database, tenant: TestTenant | undefined): Promise<void> {
  if (tenant === undefined) return
  await db.withTenant(tenant.empresaId, async tx => {
    await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.empresaId, tenant.empresaId))
    await tx.delete(documentCounters).where(eq(documentCounters.empresaId, tenant.empresaId))
    await tx.delete(branches).where(eq(branches.empresaId, tenant.empresaId))
    await tx.delete(companies).where(eq(companies.id, tenant.empresaId))
  })
}
