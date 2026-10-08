import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.ts'

/**
 * Sucursal (`Branch`, FrontEnd/src/shared/types/session.types.ts). Alcance EMPRESA.
 * UNIQUE (empresa_id, id) existe para las FK compuestas de las tablas de sucursal (ADR-BE-002 §Decisión 2).
 * RLS: migración 0001 (política empresa_id = app.empresa_id).
 */
export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [
    unique('branches_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('branches_empresa_id_code_uk').on(t.empresaId, t.code),
    check('branches_status_ck', sql`${t.status} in ('active', 'inactive')`),
  ],
)
