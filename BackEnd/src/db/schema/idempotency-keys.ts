import { foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.ts'
import { users } from './identity.ts'

/**
 * Claves de idempotencia (ADR-BE-005 › Idempotencia). Alcance: empresa + usuario + operación + clave.
 * La fila se inserta al empezar el comando, en su misma transacción: solo es visible para otros
 * cuando el comando terminó bien, así que toda fila confirmada tiene su respuesta.
 * user_id todavía sin FK: la tabla de usuarios llega en BE-1.
 * RLS: migración 0003 (tenant + borrado de vencidas sin tenant).
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    userId: uuid('user_id').notNull(),
    /** Método + plantilla de ruta: `POST /orders/:id/cancel` (ADR-BE-005, sub-decisión 1). */
    operation: text('operation').notNull(),
    key: uuid('key').notNull(),
    /** SHA-256 del body JSON canonicalizado (sub-decisión 2). */
    payloadHash: text('payload_hash').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  t => [
    primaryKey({ name: 'idempotency_keys_pk', columns: [t.empresaId, t.userId, t.operation, t.key] }),
    index('idempotency_keys_expires_at_idx').on(t.expiresAt),
    foreignKey({ name: 'idempotency_keys_user_fk', columns: [t.empresaId, t.userId], foreignColumns: [users.empresaId, users.id] }),
  ],
)
