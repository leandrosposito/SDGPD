import { createHmac } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { Actor } from '../context/actor.ts'
import { ConflictError, IdempotencyKeyReusedError } from '../http/errors.ts'
import { idempotencyKeys } from './schema/index.ts'
import type { TenantTx } from './tenant-tx.ts'

/** TTL de una clave (ADR-BE-005 › Idempotencia). */
export const IDEMPOTENCY_TTL = '48 hours'

/** Qué se ejecuta: operación (método + plantilla de ruta), clave del cliente y hash del payload. */
export type IdempotencyRequest = { operation: string; key: string; payloadHash: string }
/** Respuesta guardada para el replay. */
export type StoredResponse = { status: number; body: unknown }

/** JSON canonicalizado: claves ordenadas en todos los niveles, misma semántica que JSON.stringify. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value ?? null))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(v => canonicalize(v ?? null))
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const v: unknown = Object.getOwnPropertyDescriptor(value, key)?.value
      if (v !== undefined) out[key] = canonicalize(v)
    }
    return out
  }
  return value
}

/**
 * HMAC-SHA256 del payload JSON canonicalizado, con una clave del servidor (ADR-BE-005, sub-decisión 2,
 * enmendada en BE-1b). Antes era SHA-256 a secas: con una contraseña inicial en el body (POST /users),
 * quien leyera idempotency_keys podía probar contraseñas contra un hash rápido. Sin la clave, no.
 */
export function payloadHash(key: Uint8Array, body: unknown): string {
  return createHmac('sha256', key).update(canonicalJson(body)).digest('hex')
}

function keyOf(actor: Actor, request: IdempotencyRequest) {
  return and(
    eq(idempotencyKeys.empresaId, actor.empresaId),
    eq(idempotencyKeys.userId, actor.userId),
    eq(idempotencyKeys.operation, request.operation),
    eq(idempotencyKeys.key, request.key),
  )
}

/**
 * Registra la clave al empezar el comando, en SU transacción. Si otra transacción ya la registró y
 * no terminó, el INSERT espera en el índice único hasta que esa termine: si confirmó, la fila es
 * visible y se hace replay; si se revirtió, este INSERT entra y el comando se ejecuta. Así dos
 * requests concurrentes con la misma clave producen UNA ejecución y la misma respuesta.
 */
export async function claimKey(
  tx: TenantTx,
  actor: Actor,
  request: IdempotencyRequest,
): Promise<{ claimed: true } | { claimed: false; stored: StoredResponse }> {
  // Una clave vencida que la limpieza todavía no borró cuenta como inexistente.
  await tx.delete(idempotencyKeys).where(and(keyOf(actor, request), sql`${idempotencyKeys.expiresAt} <= now()`))
  const inserted = await tx
    .insert(idempotencyKeys)
    .values({
      empresaId: actor.empresaId,
      userId: actor.userId,
      operation: request.operation,
      key: request.key,
      payloadHash: request.payloadHash,
      expiresAt: sql`now() + ${IDEMPOTENCY_TTL}::interval`,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key })
  if (inserted.length === 1) return { claimed: true }

  const rows = await tx
    .select({
      payloadHash: idempotencyKeys.payloadHash,
      responseStatus: idempotencyKeys.responseStatus,
      responseBody: idempotencyKeys.responseBody,
    })
    .from(idempotencyKeys)
    .where(keyOf(actor, request))
  const existing = rows[0]
  if (existing === undefined || existing.responseStatus === null) {
    throw new ConflictError('idempotency-key-in-progress', 'La operación con esta Idempotency-Key sigue en curso')
  }
  if (existing.payloadHash !== request.payloadHash) throw new IdempotencyKeyReusedError()
  return { claimed: false, stored: { status: existing.responseStatus, body: existing.responseBody } }
}

/** Guarda la respuesta del comando, en la misma transacción, antes del commit. */
export async function completeKey(
  tx: TenantTx,
  actor: Actor,
  request: IdempotencyRequest,
  response: StoredResponse,
): Promise<void> {
  // Se guarda lo que viaja: el body serializado a JSON (un Date queda como string ISO, igual que en la respuesta).
  const json: unknown = response.body === undefined ? null : JSON.parse(JSON.stringify(response.body))
  await tx
    .update(idempotencyKeys)
    .set({ responseStatus: response.status, responseBody: json })
    .where(keyOf(actor, request))
}
