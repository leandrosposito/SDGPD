import type { Delivery, DeliveryStatus, DeliveryHistoryEvent, ReprogramacionEvent } from '@/shared/types/logistics.types';
import type { Branch } from '@/shared/types/session.types';
import type { DeliveryId, OrderLineId } from '@/shared/types/ids.types';
import type { DeliveryNote, DeliveryNoteLine } from '@/shared/types/deliveryNote.types';
import { puedeTransicionar } from '@/shared/types/deliveryStatus.types';
import type { PageQuery, PageResult, DateRangeQueryFilters, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { LOGISTICS_MOCK_DATA } from '@/data/mock/logistics.data';
import { httpClient } from '@/shared/api/httpClient';
import { applyDeliveryToOrderLines } from '@/modules/orders/api/orders.service';

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
//
// Tanda 8 (corrida completa, ADR-001/002): agrega la maquina de
// estados tipada (transitionDelivery/reprogramDelivery, reemplazando
// el advanceDeliveryStatus lineal de antes) y los remitos
// (registrarEntrega) — ver ADR-001/ADR-002 completos en docs/adr/.
// ============================================================

// P10: la fuente de verdad de la lista de entregas es esta variable de
// modulo (mismo patron que productsStore/stockStore en
// products.service.ts), no un store de zustand — ver
// DECISIONES_TECNICAS.md, P10, para por que useDeliveriesStore se
// elimino en vez de conservarse con un rol nuevo.
let deliveriesStore: Delivery[] = structuredClone(LOGISTICS_MOCK_DATA);

// Remitos (Tanda 8, ADR-001): append-only, nunca se edita uno
// existente — registrarEntrega solo agrega.
let deliveryNotesStore: DeliveryNote[] = [];

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
  // null solo mientras activeBranchId todavia no cargo — LogisticsPage
  // pasa `enabled: activeBranchId !== null` a usePagedQuery para ese
  // caso, asi que matchesScope nunca ve null en la practica (Tanda 5,
  // ADR-006: branding de BranchId no permite un placeholder '' valido).
  branchId: Branch['id'] | null;
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

const EMPTY_COUNT_BY_STATUS: Record<DeliveryStatus, number> = {
  CREADO: 0,
  EN_TRANSITO: 0,
  FINALIZADO: 0,
  REPROGRAMADO: 0,
  CANCELADO: 0,
};

export async function getDeliveriesPage(
  query: PageQuery<DeliveryQueryFilters, DeliverySortField>,
  signal?: AbortSignal
): Promise<PageResult<Delivery, DeliveryAggregates>> {
  return httpClient.request<PageResult<Delivery, DeliveryAggregates>>({
    method: 'GET',
    path: '/deliveries',
    params: {
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
      const { filters, sort, page, pageSize } = query;
      const inScope = filterDeliveriesInScope(filters);

      const countByStatus: Record<DeliveryStatus, number> = { ...EMPTY_COUNT_BY_STATUS };
      let pendingCollectionAmount = 0;
      for (const delivery of inScope) {
        countByStatus[delivery.status] += 1;
        if (delivery.status === 'CREADO' || delivery.status === 'EN_TRANSITO') {
          pendingCollectionAmount += delivery.collectionAmount;
        }
      }
      const totalForScope = inScope.length;

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
    params: { branchId: filters.branchId ?? undefined, status: filters.status, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
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
// Maquina de estados del viaje (ADR-002, Tanda 8). Reemplaza al viejo
// advanceDeliveryStatus (mapa lineal pending->in_transit->delivered):
// toda transicion pasa por `puedeTransicionar` antes de aplicarse, y
// queda registrada en `historial` (append-only). Contrato de
// resultado sin excepciones ni texto de UI — quien llama decide el
// toast y vuelve a pedir la pagina actual (P10).
// ============================================================

export type DeliveryTransitionReason = 'not-found' | 'invalid-transition';

export interface DeliveryTransitionResult {
  success: boolean;
  deliveryId: string;
  previousStatus?: DeliveryStatus;
  newStatus?: DeliveryStatus;
  reason?: DeliveryTransitionReason;
}

function appendHistoryEvent(delivery: Delivery, hasta: DeliveryStatus, quien: string, cuando: string): Delivery {
  const event: DeliveryHistoryEvent = { id: `dh-${Date.now()}-${delivery.historial.length}`, desde: delivery.status, hasta, quien, cuando };
  return { ...delivery, status: hasta, historial: [...delivery.historial, event] };
}

export async function transitionDelivery(
  deliveryId: DeliveryId,
  hasta: DeliveryStatus,
  quien: string
): Promise<DeliveryTransitionResult> {
  return httpClient.request<DeliveryTransitionResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/transition`,
    body: { hasta, quien },
    mock: () => {
      const delivery = deliveriesStore.find((d) => d.id === deliveryId);
      if (!delivery) {
        return { success: false, deliveryId, reason: 'not-found' };
      }
      if (!puedeTransicionar(delivery.status, hasta)) {
        return { success: false, deliveryId, previousStatus: delivery.status, reason: 'invalid-transition' };
      }

      const previousStatus = delivery.status;
      const now = new Date().toISOString();
      deliveriesStore = deliveriesStore.map((d) => (d.id === deliveryId ? appendHistoryEvent(d, hasta, quien, now) : d));

      return { success: true, deliveryId, previousStatus, newStatus: hasta };
    },
  });
}

// ------------------------------------------------------------
// Reprogramacion (ADR-002): valida la transicion a REPROGRAMADO y de
// inmediato la de vuelta a CREADO en la misma llamada — REPROGRAMADO
// nunca queda "parado" (ver deliveryStatus.types.ts). Ambos pasos
// quedan en el historial; el evento de reprogramacion en si
// (fecha anterior/nueva, motivo, responsable) vive aparte, en
// `reprogramaciones`, porque no es una transicion de estado mas, es
// el detalle de negocio de POR QUE se reprogramo.
// ------------------------------------------------------------

export interface ReprogramDeliveryInput {
  fechaNueva: string; // ISO date (yyyy-MM-dd)
  motivo: string;
  responsable: string;
}

export type ReprogramDeliveryReason = 'not-found' | 'invalid-transition';

export interface ReprogramDeliveryResult {
  success: boolean;
  deliveryId: string;
  reason?: ReprogramDeliveryReason;
}

export async function reprogramDelivery(
  deliveryId: DeliveryId,
  input: ReprogramDeliveryInput
): Promise<ReprogramDeliveryResult> {
  return httpClient.request<ReprogramDeliveryResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/reprogram`,
    body: input,
    mock: () => {
      const delivery = deliveriesStore.find((d) => d.id === deliveryId);
      if (!delivery) {
        return { success: false, deliveryId, reason: 'not-found' };
      }
      if (!puedeTransicionar(delivery.status, 'REPROGRAMADO')) {
        return { success: false, deliveryId, reason: 'invalid-transition' };
      }

      const now = new Date().toISOString();
      const reprogEvent: ReprogramacionEvent = {
        fechaAnterior: delivery.date,
        fechaNueva: input.fechaNueva,
        motivo: input.motivo,
        responsable: input.responsable,
        timestamp: now,
      };

      deliveriesStore = deliveriesStore.map((d) => {
        if (d.id !== deliveryId) return d;
        const withReprogramado = appendHistoryEvent(d, 'REPROGRAMADO', input.responsable, now);
        const withCreado = appendHistoryEvent(withReprogramado, 'CREADO', input.responsable, now);
        return { ...withCreado, date: input.fechaNueva, reprogramaciones: [...d.reprogramaciones, reprogEvent] };
      });

      return { success: true, deliveryId };
    },
  });
}

// ============================================================
// Remitos (ADR-001, Tanda 8): registrarEntrega crea el documento
// append-only, acumula `cantidadEntregada` en las lineas del pedido
// (via orders.service.ts#applyDeliveryToOrderLines, la unica funcion
// autorizada a mutar el store de orders) y finaliza el viaje.
// ============================================================

export interface RegistrarEntregaLineInput {
  orderLineId: OrderLineId;
  cantidadEntregada: number;
  cantidadRechazada: number;
  motivoRechazo?: string;
}

export type RegistrarEntregaReason = 'not-found' | 'invalid-transition' | 'no-lines';

export interface RegistrarEntregaResult {
  success: boolean;
  note?: DeliveryNote;
  reason?: RegistrarEntregaReason;
}

export async function registrarEntrega(
  deliveryId: DeliveryId,
  lines: RegistrarEntregaLineInput[],
  evidenciaIds: string[],
  creadoPor: string
): Promise<RegistrarEntregaResult> {
  return httpClient.request<RegistrarEntregaResult>({
    method: 'POST',
    path: `/deliveries/${deliveryId}/notes`,
    body: { lines, evidenciaIds, creadoPor },
    mock: async () => {
      const delivery = deliveriesStore.find((d) => d.id === deliveryId);
      if (!delivery) {
        return { success: false, reason: 'not-found' as const };
      }
      if (!puedeTransicionar(delivery.status, 'FINALIZADO')) {
        return { success: false, reason: 'invalid-transition' as const };
      }
      if (lines.length === 0) {
        return { success: false, reason: 'no-lines' as const };
      }

      const now = new Date().toISOString();
      const noteLines: DeliveryNoteLine[] = lines.map((line) => ({
        orderLineId: line.orderLineId,
        cantidadOfrecida: line.cantidadEntregada + line.cantidadRechazada,
        cantidadEntregada: line.cantidadEntregada,
        cantidadRechazada: line.cantidadRechazada,
        motivoRechazo: line.motivoRechazo,
      }));

      const note: DeliveryNote = {
        id: `remito-${Date.now()}`,
        orderId: delivery.orderId,
        deliveryId,
        fecha: now,
        lines: noteLines,
        evidenciaIds,
        creadoEn: now,
        creadoPor,
      };

      // Solo lo ACEPTADO (cantidadEntregada) acumula en las lineas del
      // pedido — lo rechazado nunca cuenta como entregado.
      await applyDeliveryToOrderLines(
        delivery.orderId,
        lines.filter((l) => l.cantidadEntregada > 0).map((l) => ({ orderLineId: l.orderLineId, cantidadEntregada: l.cantidadEntregada }))
      );

      deliveryNotesStore = [...deliveryNotesStore, note];
      deliveriesStore = deliveriesStore.map((d) => (d.id === deliveryId ? appendHistoryEvent(d, 'FINALIZADO', creadoPor, now) : d));

      return { success: true, note };
    },
  });
}

// Historial de remitos de una entrega puntual — usado por el panel de
// historial de la UI (Tanda 8). No pasa por httpClient: es una
// lectura chica y sincronica sobre un array que ya vive en memoria del
// navegador (no hay latencia real que simular para esto, a diferencia
// de un GET real).
export function getDeliveryNotesForDelivery(deliveryId: DeliveryId): DeliveryNote[] {
  return deliveryNotesStore.filter((note) => note.deliveryId === deliveryId);
}
