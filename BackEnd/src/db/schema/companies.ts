import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Empresa: la única tabla sin empresa_id, porque su id es el tenant (ADR-BE-002, sub-decisión 1).
 * RLS: migración 0001 (política id = app.empresa_id).
 */
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  /** Zona horaria IANA (`America/Argentina/Cordoba`) para resolver "hoy" (ADR-BE-004, sub-decisión 4). */
  timezone: text('timezone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})
