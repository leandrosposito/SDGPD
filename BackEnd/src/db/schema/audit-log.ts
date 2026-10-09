import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity.ts'

export const AUDIT_ACTIONS = ['create', 'update', 'delete'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/**
 * Auditoría genérica (ADR-BE-005 › Auditoría, sub-decisión 7): la escribe la infraestructura en la
 * misma transacción que el cambio. Append-only: los roles de aplicación solo tienen INSERT y SELECT
 * (scripts/db/lib.ts, APPEND_ONLY_TABLES) y no hay políticas de UPDATE ni DELETE.
 * Sin FK a companies a propósito: el registro sobrevive a la fila que audita y no se borra nunca.
 * user_id todavía sin FK: la tabla de usuarios llega en BE-1.
 * Se lee con cursor sobre (at, id) (ADR-BE-004).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id').notNull(),
    userId: uuid('user_id').notNull(),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    action: text('action', { enum: AUDIT_ACTIONS }).notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    requestId: uuid('request_id').notNull(),
  },
  t => [
    index('audit_log_empresa_at_id_idx').on(t.empresaId, t.at, t.id),
    index('audit_log_entity_idx').on(t.empresaId, t.entity, t.entityId),
    foreignKey({ name: 'audit_log_user_fk', columns: [t.empresaId, t.userId], foreignColumns: [users.empresaId, users.id] }),
    check('audit_log_action_ck', sql`${t.action} in ('create', 'update', 'delete')`),
  ],
)
