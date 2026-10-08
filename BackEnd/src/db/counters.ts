import { sql } from 'drizzle-orm'
import { type DocumentSeries, documentCounters } from './schema/index.ts'
import type { TenantTx } from './tenant-tx.ts'

const NUMBER_DIGITS = 6

/**
 * Próximo número de una serie de la empresa (ADR-BE-006 §Decisión 4, sub-decisión 5): `SERIE-` + 6
 * dígitos. INSERT … ON CONFLICT DO UPDATE … RETURNING: la fila del contador queda bloqueada hasta el
 * commit de la transacción del comando, así que dos comandos concurrentes se serializan, y un rollback
 * deshace el incremento (no deja hueco). Pasado 999999 el número sigue creciendo, con más dígitos.
 */
export async function nextNumber(tx: TenantTx, empresaId: string, series: DocumentSeries): Promise<string> {
  const rows = await tx
    .insert(documentCounters)
    .values({ empresaId, series, lastValue: 1 })
    .onConflictDoUpdate({
      target: [documentCounters.empresaId, documentCounters.series],
      set: { lastValue: sql`${documentCounters.lastValue} + 1` },
    })
    .returning({ value: documentCounters.lastValue })
  const value = rows[0]?.value
  if (value === undefined) throw new Error(`el contador ${series} no devolvió valor`)
  return `${series}-${String(value).padStart(NUMBER_DIGITS, '0')}`
}
