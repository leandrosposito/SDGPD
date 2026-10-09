import { and, eq, isNull, sql } from 'drizzle-orm'
import { newId } from './ids.ts'
import { refreshTokens } from './schema/index.ts'
import type { TenantTx } from './tenant-tx.ts'

/** Vida de cada refresh token (ADR-BE-003, sub-decisión 3). Cada rotación emite uno nuevo con 30 días. */
export const REFRESH_TOKEN_TTL = '30 days'

/** Inserta un refresh token (solo su hash) en la familia dada. */
export async function insertRefreshToken(
  tx: TenantTx,
  token: { empresaId: string; userId: string; familyId: string; tokenHash: string },
): Promise<void> {
  await tx.insert(refreshTokens).values({
    id: newId(),
    ...token,
    expiresAt: sql`now() + ${REFRESH_TOKEN_TTL}::interval`,
  })
}

/** Revoca todos los tokens vigentes de una familia (reuso, logout, usuario inactivo). */
export async function revokeFamily(tx: TenantTx, familyId: string): Promise<void> {
  await tx
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
}

/** Revoca todos los refresh tokens vigentes de un usuario (al desactivarlo). */
export async function revokeUserRefreshTokens(tx: TenantTx, userId: string): Promise<void> {
  await tx
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
}
