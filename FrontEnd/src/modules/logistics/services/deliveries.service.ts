import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageQuery, PageResult, DateRangeQueryFilters, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { LOGISTICS_MOCK_DATA } from '@/data/mock/logistics.data';
import { httpClient } from '@/shared/api/httpClient';

// ============================================================
// deliveries.service — Acceso a datos de entregas (P1,
// DECISIONES_TECNICAS.md). Pasa por httpClient (Tanda 2.5 de
// escalabilidad): timeout, reintentos, cancelacion real y
// VITE_MOCK_LATENCY_MS/VITE_MOCK_FAILURE_RATE/VITE_API_DEBUG ya no
// son exclusivos de suppliers.service.ts. El servicio hace de
// backend, no de repositorio: filtra, ordena, cuenta y corta el — no
// devuelve el dataset completo para que la vista lo procese.
//
// branchId es un parametro explicito dentro de `filters`, no se lee de
// ningun store (D4/P9): mantiene la capa de datos sin estado global
// oculto. Que el front mande este branchId es una conveniencia de UI,
// no una autorizacion — el backend real debera validar igual que la
// sucursal pedida pertenezca a la empresa de la sesion antes de
// responder.
// ============================================================

// P10: la fuente de verdad de la lista de entregas es esta variable de
// modulo (mismo patron que productsStore/stockStore en
// products.service.ts), no un store de zustand — ver
// DECISIONES_TECNICAS.md, P10, para por que useDeliveriesStore se
// elimino en vez de conservarse con un rol nuevo.
let deliveriesStore: Delivery[] = structuredClone(LOGISTICS_MOCK_DATA);

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// date (un solo dia, exact-match) paso a ser dateFrom/dateTo (rango,
// DateRangeFilter — tarea transversal): LogisticsPage sigue usando
// "Hoy" como default (dateFrom=dateTo=hoy es equivalente al viejo
// comportamiento fijo), pero ahora el usuario puede elegir otro rango.
export interface DeliveryQueryFilters extends DateRangeQueryFilters {
  branchId: Branch['id'];
  // undefined = todos los estados (filtro "Todas" en DeliveryFilters).
  status?: DeliveryStatus;
}

export type DeliverySortField = 'estimatedTime' | 'collectionAmount' | 'clientName';

// Agregados de logistica (P3): calculados sobre TODO lo que matchea
// fecha+sucursal, sin aplicar el filtro de estado — asi los contadores
// de DeliveryFilters y los KPIs de LogisticsKPIs no cambian segun cual
// estado este seleccionado (mismo comportamiento que tenia la pantalla
// antes de paginar: los KPIs y los contadores por estado siempre
// reflejaban "hoy, esta sucursal", no el subconjunto ya filtrado).
export interface DeliveryAggregates {
  countByStatus: Record<DeliveryStatus, number>;
  // Igual a la suma de countByStatus, pero ya resuelta aca: ningun
  // componente debe sumarla (P3), ni siquiera un total tan trivial.
  totalForScope: number;
  pendingCollectionAmount: number;
}

// dateFrom/dateTo son ISO date puro (yyyy-MM-dd), igual que
// `delivery.date` — comparacion directa de strings, sin necesidad de
// normalizar a solo la porcion de dia (a diferencia de purchaseOrders,
// que compara contra un ISO datetime completo).
function isWithinDateRange(dateISO: string, dateFrom: string | undefined, dateTo: string | undefined): boolean {
  if (dateFrom && dateISO < dateFrom) return false;
  if (dateTo && dateISO > dateTo) return false;
  return true;
}

function matchesScope(delivery: Delivery, filters: DeliveryQueryFilters): boolean {
  return (
    delivery.branchId === filters.branchId &&
    isWithinDateRange(delivery.date, filters.dateFrom, filters.dateTo)
  );
}

function compareDeliveries(a: Delivery, b: Delivery, field: DeliverySortField): number {
  switch (field) {
    case 'collectionAmount':
      return a.collectionAmount - b.collectionAmount;
    case 'clientName':
      return a.clientName.localeCompare(b.clientName);
    case 'estimatedTime':
    default:
      return a.estimatedTime.localeCompare(b.estimatedTime);
  }
}

// Compartido entre getDeliveriesPage y exportDeliveries (no se duplica
// la logica de filtrado/orden entre paginado y export).
function filterDeliveriesInScope(filters: DeliveryQueryFilters): Delivery[] {
  return deliveriesStore.filter((d) => matchesScope(d, filters));
}

function sortDeliveries(
  deliveries: Delivery[],
  sort: { field: DeliverySortField; direction: 'asc' | 'desc' } | undefined
): Delivery[] {
  const sortField = sort?.field ?? 'estimatedTime';
  const direction = sort?.direction ?? 'asc';
  return [...deliveries].sort((a, b) => {
    const cmp = compareDeliveries(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.4): un orden ambiguo hace que la
    // misma entrega aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

export async function getDeliveriesPage(
  query: PageQuery<DeliveryQueryFilters, DeliverySortField>,
  signal?: AbortSignal
): Promise<PageResult<Delivery, DeliveryAggregates>> {
  return httpClient.request<PageResult<Delivery, DeliveryAggregates>>({
    method: 'GET',
    path: '/deliveries',
    params: {
      branchId: query.filters.branchId,
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
      const { filters, sort, page, pageSize } = query;
      const inScope = filterDeliveriesInScope(filters);

      const countByStatus: Record<DeliveryStatus, number> = { pending: 0, in_transit: 0, delivered: 0 };
      let pendingCollectionAmount = 0;
      for (const delivery of inScope) {
        countByStatus[delivery.status] += 1;
        if (delivery.status === 'pending' || delivery.status === 'in_transit') {
          pendingCollectionAmount += delivery.collectionAmount;
        }
      }
      const totalForScope = countByStatus.pending + countByStatus.in_transit + countByStatus.delivered;

      const filtered = filters.status ? inScope.filter((d) => d.status === filters.status) : inScope;

      const sorted = sortDeliveries(filtered, sort);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      // Si la pagina pedida quedo fuera de rango (ej. una mutacion redujo
      // el total), se devuelve la ultima pagina valida en vez de un array
      // vacio — quien consume el contrato se realinea con `result.page`.
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return {
        items: structuredClone(items),
        total,
        page: safePage,
        pageSize,
        aggregates: { countByStatus, totalForScope, pendingCollectionAmount },
      };
    },
  });
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
    params: { branchId: filters.branchId, status: filters.status, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    mock: () => {
      const inScope = filterDeliveriesInScope(filters);
      const filtered = filters.status ? inScope.filter((d) => d.status === filters.status) : inScope;
      const sorted = sortDeliveries(filtered, sort);

      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS);

      return { items: structuredClone(items), truncated };
    },
  });
}

// ============================================================
// Mutacion de estado de una entrega (antes vivia en
// useDeliveriesStore#advanceDeliveryStatus). Async + estructura de
// resultado sin excepciones ni texto de UI, mismo contrato que antes
// — solo cambia que ahora muta el store del servicio, no un store de
// zustand. Quien llama (LogisticsPage) decide el toast Y vuelve a
// pedir la pagina actual (P10: ver DECISIONES_TECNICAS.md).
// ============================================================

const DELIVERY_STATUS_FLOW: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  pending: 'in_transit',
  in_transit: 'delivered',
};

export type DeliveryStatusTransitionReason = 'not-found' | 'terminal-status';

export interface DeliveryStatusTransitionResult {
  success: boolean;
  deliveryId: string;
  previousStatus?: DeliveryStatus;
  newStatus?: DeliveryStatus;
  reason?: DeliveryStatusTransitionReason;
}

export async function advanceDeliveryStatus(deliveryId: string): Promise<DeliveryStatusTransitionResult> {
  return httpClient.request<DeliveryStatusTransitionResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/advance`,
    mock: () => {
      const delivery = deliveriesStore.find((d) => d.id === deliveryId);
      if (!delivery) {
        return { success: false, deliveryId, reason: 'not-found' };
      }

      const nextStatus = DELIVERY_STATUS_FLOW[delivery.status];
      if (!nextStatus) {
        return { success: false, deliveryId, previousStatus: delivery.status, reason: 'terminal-status' };
      }

      deliveriesStore = deliveriesStore.map((d) => (d.id === deliveryId ? { ...d, status: nextStatus } : d));

      return { success: true, deliveryId, previousStatus: delivery.status, newStatus: nextStatus };
    },
  });
}
