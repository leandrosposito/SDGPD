import { sql } from 'drizzle-orm'
import { bigint, check, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.ts'

/** Series de numeración por empresa (ADR-BE-006 §Decisión 4, sub-decisión 5). */
export const DOCUMENT_SERIES = ['PED', 'REM', 'OC', 'REC', 'VIA', 'RCB'] as const
export type DocumentSeries = (typeof DOCUMENT_SERIES)[number]

/**
 * Contador por empresa y serie. Se incrementa con INSERT … ON CONFLICT DO UPDATE … RETURNING dentro
 * de la transacción del comando: la fila queda bloqueada hasta el commit y un rollback no consume número.
 * RLS: migración 0003.
 */
export const documentCounters = pgTable(
  'document_counters',
  {
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    series: text('series', { enum: DOCUMENT_SERIES }).notNull(),
    lastValue: bigint('last_value', { mode: 'number' }).notNull(),
  },
  t => [
    primaryKey({ name: 'document_counters_pk', columns: [t.empresaId, t.series] }),
    check('document_counters_series_ck', sql`${t.series} in ('PED', 'REM', 'OC', 'REC', 'VIA', 'RCB')`),
    check('document_counters_last_value_ck', sql`${t.lastValue} >= 1`),
  ],
)
