import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types'
import type { DeliveryId, OrderId } from '@/shared/types/ids.types'
import { computeAllowedTransitions } from '@/shared/types/deliveryStatus.types'
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types'
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types'
import { httpClient } from '@/shared/api/httpClient'
import type {
  DeliveryQueryFilters,
  DeliverySortField,
  DeliveryAggregates,
} from './deliveries.types'
import { listDeliveries } from './deliveries.store'
import { filterDeliveriesInScope, sortDeliveries, EMPTY_COUNT_BY_STATUS } from './deliveries.scope'

export async function getDeliveriesPage(
  query: PageQuery<DeliveryQueryFilters, DeliverySortField>,
  signal?: AbortSignal
): Promise<PageResult<Delivery, DeliveryAggregates>> {
  return httpClient.request<PageResult<Delivery, DeliveryAggregates>>({
    method: 'GET',
    path: '/deliveries',
    params: {
      empresaId: query.filters.empresaId,
      branchId: query.filters.branchId ?? undefined,
      status: query.filters.status,
      dateFrom: query.filters.dateFrom,
      dateTo: query.filters.dateTo,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { filters, sort, page, pageSize } = query
      const inScope = filterDeliveriesInScope(filters)

      const countByStatus: Record<DeliveryStatus, number> = { ...EMPTY_COUNT_BY_STATUS }
      let pendingCollectionAmount = 0
      for (const delivery of inScope) {
        countByStatus[delivery.status] += 1
        if (delivery.status === 'CREADO' || delivery.status === 'EN_TRANSITO') {
          pendingCollectionAmount += delivery.collectionAmount
        }
      }
      const totalForScope = inScope.length

      const filtered = filters.status ? inScope.filter(d => d.status === filters.status) : inScope

      const sorted = sortDeliveries(filtered, sort)

      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      // Si la pagina pedida quedo fuera de rango (ej. una mutacion redujo
      // el total), se devuelve la ultima pagina valida en vez de un array
      // vacio — quien consume el contrato se realinea con `result.page`.
      const safePage = Math.min(Math.max(1, page), totalPages)
      const start = (safePage - 1) * pageSize
      // allowedTransitions (Tanda 9, ADR-010 seccion 3): calculado acá,
      // en la respuesta — nunca persistido en el store. El
      // cliente (DeliveriesTable.tsx) lee este array, no vuelve a
      // llamar puedeTransicionar/computeAllowedTransitions por su
      // cuenta.
      const items = sorted
        .slice(start, start + pageSize)
        .map(d => ({ ...d, allowedTransitions: computeAllowedTransitions(d.status) }))

      return {
        items: structuredClone(items),
        total,
        page: safePage,
        pageSize,
        aggregates: { countByStatus, totalForScope, pendingCollectionAmount },
      }
    },
  })
}

// Exportar (tarea transversal, DECISIONES_TECNICAS.md): TODO lo que
// matchea filtros+estado, sin paginar, hasta MAX_EXPORT_ROWS. Reusa
// filterDeliveriesInScope/sortDeliveries (misma logica que
// getDeliveriesPage, no duplicada).
export async function exportDeliveries(
  filters: DeliveryQueryFilters,
  sort?: { field: DeliverySortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<Delivery>> {
  return httpClient.request<ExportResult<Delivery>>({
    method: 'GET',
    path: '/deliveries/export',
    params: {
      empresaId: filters.empresaId,
      branchId: filters.branchId ?? undefined,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    mock: () => {
      const inScope = filterDeliveriesInScope(filters)
      const filtered = filters.status ? inScope.filter(d => d.status === filters.status) : inScope
      const sorted = sortDeliveries(filtered, sort)

      const truncated = sorted.length > MAX_EXPORT_ROWS
      const items = sorted.slice(0, MAX_EXPORT_ROWS)

      return { items: structuredClone(items), truncated }
    },
  })
}

// ------------------------------------------------------------
// getDeliveriesForOrder — todas las Delivery de UN pedido puntual
// (hallazgo A15#4: un pedido puede repartirse en 2-3 entregas, incluso
// en sucursales distintas). Consumida por OrderDetailPanel.tsx para
// derivar logisticoResumen/estadoFinancieroResumen
// (shared/utils/orderLogistics.ts) — sincroniza la vista del pedido
// sin que exista un campo duplicado que pueda desalinearse (hallazgo
// A15#3): siempre lee las Delivery reales, nunca una copia.
//
// No pagina server-side: el universo es "las entregas de este pedido",
// no la coleccion completa de la empresa — mismo criterio que
// getDeliveryNotesForDelivery, no el de getDeliveriesPage.
// ------------------------------------------------------------
export async function getDeliveriesForOrder(
  empresaId: string,
  orderId: OrderId,
  signal?: AbortSignal
): Promise<Delivery[]> {
  return httpClient.request<Delivery[]>({
    method: 'GET',
    path: `/orders/${orderId}/deliveries`,
    params: { empresaId },
    signal,
    mock: () => structuredClone(listDeliveries().filter(d => d.orderId === orderId)),
  })
}

// ------------------------------------------------------------
// getDeliveriesByIds — Tanda 10B: TripDetailPanel.tsx necesita el
// detalle (cliente, direccion, estado, monto a cobrar) de las Delivery
// que cada Parada referencia por id — Stop solo guarda `deliveryIds`
// (ver trip.types.ts), nunca una copia de la Delivery. Universo
// acotado (las entregas de las paradas de UN viaje abierto en el
// panel, nunca la coleccion completa), mismo criterio que
// getDeliveriesForOrder.
// ------------------------------------------------------------
export async function getDeliveriesByIds(
  empresaId: string,
  deliveryIds: DeliveryId[],
  signal?: AbortSignal
): Promise<Delivery[]> {
  return httpClient.request<Delivery[]>({
    method: 'GET',
    path: '/deliveries/by-ids',
    params: { empresaId, ids: deliveryIds.join(',') },
    signal,
    mock: () => structuredClone(listDeliveries().filter(d => deliveryIds.includes(d.id))),
  })
}
