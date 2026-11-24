import type { ClientAccount, OpenInvoice, OverdueClientRow } from '@/shared/types/client.types'
import type { DateRangeQueryFilters } from '@/shared/types/pagination.types'

export interface ClientsQueryFilters {
  empresaId: string
  search?: string
  zone?: string
  seller?: string
  status?: ClientAccount['status']
}

// Un solo campo de orden: el Directorio no tenía sort de columna
// clickeable antes de esta tanda — se ordena por nombre, sin
// selector en la UI que la vista original tampoco tenía (mismo
// criterio que UsersSortField en settings, Tanda 3c).
export type ClientsSortField = 'clientName'

// dateFrom/dateTo (DateRangeFilter, tarea transversal) — Opcion A
// (decidida explicitamente, ver DECISIONES_TECNICAS.md): filtro de
// EXISTENCIA. Solo acota QUE clientes aparecen (los que tengan al
// menos una transaccion en el rango); totalDebit/totalCredit/
// currentBalance de la fila siguen siendo los saldos reales de la
// cuenta completa, nunca recalculados sobre el rango — la Opcion B
// (recalcular saldos sobre el rango) es una feature de reporteria
// distinta, fuera de alcance de esta tarea.
export interface ClientAccountsQueryFilters extends DateRangeQueryFilters {
  // Regla 3.5 del protocolo: toda funcion de service lleva empresaId
  // explicito. Agregado en el barrido de AUDIT_2026-09-08_empresaId-sweep.md.
  empresaId: string
  search?: string
}

export type ClientAccountsSortField = 'clientName' | 'currentBalance' | 'creditLimit'

export interface OverdueSnapshotEntry {
  row: OverdueClientRow
  openInvoices: OpenInvoice[] // solo las vencidas, para los agregados por tramo
}
