import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types'
import type { DeliveryQueryFilters, DeliverySortField } from './deliveries.types'
import { listDeliveries } from './deliveries.store'

export { toLocalDateString as toISODate } from '@/shared/utils/date'

// dateFrom/dateTo son ISO date puro (yyyy-MM-dd), igual que
// `delivery.date` — comparacion directa de strings, sin necesidad de
// normalizar a solo la porcion de dia (a diferencia de purchaseOrders,
// que compara contra un ISO datetime completo).
function isWithinDateRange(
  dateISO: string,
  dateFrom: string | undefined,
  dateTo: string | undefined
): boolean {
  if (dateFrom && dateISO < dateFrom) return false
  if (dateTo && dateISO > dateTo) return false
  return true
}

export function matchesScope(delivery: Delivery, filters: DeliveryQueryFilters): boolean {
  return (
    delivery.branchId === filters.branchId &&
    isWithinDateRange(delivery.date, filters.dateFrom, filters.dateTo)
  )
}

function compareDeliveries(a: Delivery, b: Delivery, field: DeliverySortField): number {
  switch (field) {
    case 'collectionAmount':
      return a.collectionAmount - b.collectionAmount
    case 'clientName':
      return a.clientName.localeCompare(b.clientName)
    case 'estimatedTime':
    default:
      return a.estimatedTime.localeCompare(b.estimatedTime)
  }
}

// Compartido entre getDeliveriesPage y exportDeliveries (no se duplica
// la logica de filtrado/orden entre paginado y export).
export function filterDeliveriesInScope(filters: DeliveryQueryFilters): Delivery[] {
  return listDeliveries().filter(d => matchesScope(d, filters))
}

export function sortDeliveries(
  deliveries: Delivery[],
  sort: { field: DeliverySortField; direction: 'asc' | 'desc' } | undefined
): Delivery[] {
  const sortField = sort?.field ?? 'estimatedTime'
  const direction = sort?.direction ?? 'asc'
  return [...deliveries].sort((a, b) => {
    const cmp = compareDeliveries(a, b, sortField)
    const primary = direction === 'asc' ? cmp : -cmp
    // Desempate estable por id (3.4): un orden ambiguo hace que la
    // misma entrega aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id)
  })
}

export const EMPTY_COUNT_BY_STATUS: Record<DeliveryStatus, number> = {
  CREADO: 0,
  EN_TRANSITO: 0,
  FINALIZADO: 0,
  REPROGRAMADO: 0,
  CANCELADO: 0,
}
