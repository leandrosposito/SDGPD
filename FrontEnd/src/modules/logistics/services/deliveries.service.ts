import type { Delivery, DeliveryStatus, DeliveryHistoryEvent, ReprogramacionEvent } from '@/shared/types/logistics.types';
import type { Branch } from '@/shared/types/session.types';
import type { DeliveryId, OrderLineId, OrderId, BranchId, TripId, StopId } from '@/shared/types/ids.types';
import { asDeliveryId, asDeliveryNoteId, asDeliveryHistoryEventId } from '@/shared/types/ids.types';
import type { DeliveryNote, DeliveryNoteLine } from '@/shared/types/deliveryNote.types';
import { puedeTransicionar, computeAllowedTransitions } from '@/shared/types/deliveryStatus.types';
import { getMotivoCatalog } from '@/shared/api/motivos/motivos.service';
import { MOTIVO_OTRO_CODIGO, type MotivoTipo } from '@/shared/types/motivo.types';
import type { PageQuery, PageResult, DateRangeQueryFilters, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { LOGISTICS_MOCK_DATA } from '@/data/mock/logistics.data';
import { httpClient } from '@/shared/api/httpClient';
import { applyDeliveryToOrderLines, getOrderById } from '@/modules/orders/api/orders.service';
// Tanda 10B: withIdempotency se extrajo a shared/utils/idempotency.ts
// (antes vivia solo aca) para que trips.service.ts#registerPod pueda
// usar el mismo mecanismo sin duplicar el mapa clave->resultado — ver
// ese archivo para el razonamiento completo (sin cambios de
// comportamiento, mismo codigo, otro archivo).
import { withIdempotency } from '@/shared/utils/idempotency';
// Tanda 11 (ADR-013): dependencia de import EN LA DIRECCION CONTRARIA a
// la que ya existe en este archivo hacia deliveries<-orders (arriba) y
// a la que trips.service.ts ya tiene hacia este mismo archivo
// (getDeliveryById/getDeliveryIdsMatchingFilter/transitionDelivery) —
// mismo patron ya verificado seguro en Tanda 9 para
// orders.service.ts<->deliveries.service.ts: ninguno de los dos lados
// consume el import a nivel de MODULO, solo dentro del cuerpo de una
// funcion invocada despues de que ambos modulos terminaron de cargar.
import { releaseDeliveryFromTrip } from './trips.service';

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

// ------------------------------------------------------------
// getOrderBranchLinksForAggregation — ADR-009 (alcance del dashboard).
// Llamada "servidor a servidor" (dashboardAggregates.service.ts, otro
// modulo, la invoca) — mismo criterio que
// orders.service.ts#getOrdersSnapshotForAggregation/applyDeliveryToOrderLines:
// la variable de store (`deliveriesStore`) nunca sale de este archivo,
// solo funciones que la leen bajo control de este service. No pasa
// por httpClient a proposito, mismo motivo ya documentado ahi.
//
// Es la relacion real que permite filtrar pedidos por sucursal sin
// agregarle branchId a Order (Order es alcance EMPRESA, decision ya
// cerrada) — un pedido "pertenece" a una sucursal si tiene al menos
// una Delivery con ese branchId.
// ------------------------------------------------------------
export function getOrderBranchLinksForAggregation(): { orderId: OrderId; branchId: BranchId }[] {
  return deliveriesStore.map((d) => ({ orderId: d.orderId, branchId: d.branchId }));
}

// ------------------------------------------------------------
// getActiveDeliveriesForOrder — Fix del hallazgo ALTO de Fase 3
// (VERIFICACION_TANDA_9.md): orders.service.ts#cancelOrder necesita
// saber, ANTES de cancelar, si el pedido tiene alguna entrega en curso.
// "Activa" = CREADO o EN_TRANSITO (las mismas que dejan botones de
// accion en DeliveriesTable) — REPROGRAMADO no aplica porque
// reprogramDelivery lo resuelve a CREADO en la misma llamada, nunca
// queda "parado" ahi (deliveryStatus.types.ts); FINALIZADO/CANCELADO
// son terminales, no bloquean cancelar el pedido.
//
// Llamada "servidor a servidor" en la direccion CONTRARIA a la ya
// documentada en este archivo (applyDeliveryToOrderLines/getOrderById
// van deliveries -> orders): a partir de este fix, orders.service.ts
// importa de este archivo tambien. Es segura — ninguno de los dos
// lados consume el import a nivel de MODULO, solo dentro del cuerpo de
// una funcion (misma razon por la que un ciclo de imports de solo
// funciones no rompe con ESM/Vite) — pero es una desviacion real de
// "una sola direccion" que no se pudo evitar sin duplicar acá el
// criterio de "que es una entrega activa" dentro de orders.service.ts.
// ------------------------------------------------------------
export function getActiveDeliveriesForOrder(orderId: OrderId): Delivery[] {
  return deliveriesStore.filter((d) => d.orderId === orderId && (d.status === 'CREADO' || d.status === 'EN_TRANSITO'));
}

// ------------------------------------------------------------
// getDeliveryById / getDeliveryIdsMatchingFilter — Tanda 10B: llamadas
// "servidor a servidor" (mismo criterio que getActiveDeliveriesForOrder
// y getOrderBranchLinksForAggregation) que trips.service.ts necesita:
// - getDeliveryById: registerPod confirma el estado actual de la
//   Delivery antes de finalizarla.
// - getDeliveryIdsMatchingFilter: assignDeliveriesToStop, modo
//   'filtro' (ADR-011 seccion 1) — reusa el MISMO matchesScope que
//   getDeliveriesPage en vez de reinterpretar el filtro en
//   trips.service.ts, y ademas exige status CREADO (solo lo que
//   todavia no salio a reparto es candidato a asignarse a un viaje).
// ------------------------------------------------------------
export function getDeliveryById(deliveryId: DeliveryId): Delivery | undefined {
  return deliveriesStore.find((d) => d.id === deliveryId);
}

export function getDeliveryIdsMatchingFilter(filters: DeliveryQueryFilters): DeliveryId[] {
  return deliveriesStore.filter((d) => matchesScope(d, filters) && d.status === 'CREADO').map((d) => d.id);
}

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
  // Regla 3.5 del protocolo: toda funcion de service lleva empresaId
  // explicito (AUDIT_2026-09-08_empresaId-sweep.md) — faltaba en las 6
  // funciones de este archivo, corregido en este lote.
  empresaId: string;
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
      // allowedTransitions (Tanda 9, ADR-010 seccion 3): calculado acá,
      // en la respuesta — nunca persistido en deliveriesStore. El
      // cliente (DeliveriesTable.tsx) lee este array, no vuelve a
      // llamar puedeTransicionar/computeAllowedTransitions por su
      // cuenta.
      const items = sorted
        .slice(start, start + pageSize)
        .map((d) => ({ ...d, allowedTransitions: computeAllowedTransitions(d.status) }));

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
    params: {
      empresaId: filters.empresaId,
      branchId: filters.branchId ?? undefined,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
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
  const event: DeliveryHistoryEvent = {
    id: asDeliveryHistoryEventId(`dh-${Date.now()}-${delivery.historial.length}`),
    desde: delivery.status,
    hasta,
    quien,
    cuando,
  };
  return { ...delivery, status: hasta, historial: [...delivery.historial, event] };
}

export async function transitionDelivery(
  empresaId: string,
  idempotencyKey: string,
  deliveryId: DeliveryId,
  hasta: DeliveryStatus,
  quien: string
): Promise<DeliveryTransitionResult> {
  return httpClient.request<DeliveryTransitionResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/transition`,
    body: { empresaId, idempotencyKey, hasta, quien },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
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
      }),
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
  // Tanda 11 (ADR-013): motivo de texto libre -> catalogo, mismo
  // patron que RegistrarEntregaLineInput/'rechazo'. motivoTipo decide
  // contra que catalogo se resuelve — la misma funcion sirve tanto a
  // ReprogramarModal ('reprogramacion') como al flujo de "entrega no
  // realizada" de trips.service.ts#markStopNoVisitada ('no-entrega').
  motivoCodigo: string;
  motivoOtroTexto?: string;
  motivoTipo: MotivoTipo;
  responsable: string;
  // Tanda 13 (hallazgo propio, enmienda ADR-013): trazabilidad — solo
  // trips.service.ts#markStopNoVisitada los pasa (la reprogramacion
  // nace de intentar marcar esa Parada como no visitada);
  // ReprogramarModal.tsx nunca los pasa (reprogramacion
  // "administrativa", sin viaje en curso). Ver ReprogramacionEvent en
  // logistics.types.ts para el razonamiento completo.
  tripId?: TripId;
  stopId?: StopId;
}

export type ReprogramDeliveryReason = 'not-found' | 'invalid-transition' | 'motivo-invalido';

export interface ReprogramDeliveryResult {
  success: boolean;
  deliveryId: string;
  reason?: ReprogramDeliveryReason;
}

export async function reprogramDelivery(
  empresaId: string,
  idempotencyKey: string,
  deliveryId: DeliveryId,
  input: ReprogramDeliveryInput
): Promise<ReprogramDeliveryResult> {
  return httpClient.request<ReprogramDeliveryResult>({
    method: 'PUT',
    path: `/deliveries/${deliveryId}/reprogram`,
    body: { empresaId, idempotencyKey, ...input },
    mock: async () => {
      const delivery = deliveriesStore.find((d) => d.id === deliveryId);
      if (!delivery) {
        return { success: false, deliveryId, reason: 'not-found' as const };
      }
      if (!puedeTransicionar(delivery.status, 'REPROGRAMADO')) {
        return { success: false, deliveryId, reason: 'invalid-transition' as const };
      }
      if (!input.motivoCodigo) {
        return { success: false, deliveryId, reason: 'motivo-invalido' as const };
      }
      if (input.motivoCodigo === MOTIVO_OTRO_CODIGO && !input.motivoOtroTexto?.trim()) {
        return { success: false, deliveryId, reason: 'motivo-invalido' as const };
      }

      // Resuelve motivoCodigo -> texto server-side, mismo criterio que
      // registrarEntrega (nunca confia en texto que mande el cliente).
      const catalogo = await getMotivoCatalog(empresaId, input.motivoTipo);
      const motivoTexto =
        input.motivoCodigo === MOTIVO_OTRO_CODIGO
          ? input.motivoOtroTexto!.trim()
          : catalogo.find((m) => m.codigo === input.motivoCodigo)?.descripcion;
      if (!motivoTexto) {
        return { success: false, deliveryId, reason: 'motivo-invalido' as const };
      }

      return withIdempotency(idempotencyKey, () => {
        const now = new Date().toISOString();
        const reprogEvent: ReprogramacionEvent = {
          fechaAnterior: delivery.date,
          fechaNueva: input.fechaNueva,
          motivo: motivoTexto,
          motivoCodigo: input.motivoCodigo,
          responsable: input.responsable,
          timestamp: now,
          tripId: input.tripId,
          stopId: input.stopId,
        };

        deliveriesStore = deliveriesStore.map((d) => {
          if (d.id !== deliveryId) return d;
          const withReprogramado = appendHistoryEvent(d, 'REPROGRAMADO', input.responsable, now);
          const withCreado = appendHistoryEvent(withReprogramado, 'CREADO', input.responsable, now);
          return { ...withCreado, date: input.fechaNueva, reprogramaciones: [...d.reprogramaciones, reprogEvent] };
        });

        // ADR-013 seccion 1: si esta entrega estaba asignada a la
        // Parada de algun viaje, la libera (recalcula capacidadUsada/
        // sobrecargado, incrementa version) — sin esto quedaba
        // "fantasma" en el viaje pese a tener fecha/estado nuevos.
        // "Volver a la cola de pendientes" no es una cola nueva: con la
        // entrega en CREADO (arriba) y sin ningun viaje que la
        // referencie (aca), ya vuelve a cumplir las dos condiciones que
        // CreateTripModal/getDeliveryIdsMatchingFilter usan para
        // considerarla candidata.
        releaseDeliveryFromTrip(deliveryId);

        return { success: true, deliveryId };
      });
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
  // Tanda 9 (ADR-010 seccion 5): reemplaza al motivoRechazo de texto
  // libre — motivoCodigo referencia MotivoCatalogItem.codigo ('OTRO'
  // incluido). motivoOtroTexto solo se usa/exige cuando el codigo es
  // 'OTRO'.
  motivoCodigo?: string;
  motivoOtroTexto?: string;
}

export type RegistrarEntregaReason = 'not-found' | 'invalid-transition' | 'no-lines' | 'motivo-invalido' | 'propagation-failed';

export interface RegistrarEntregaResult {
  success: boolean;
  note?: DeliveryNote;
  reason?: RegistrarEntregaReason;
}

export async function registrarEntrega(
  empresaId: string,
  idempotencyKey: string,
  deliveryId: DeliveryId,
  lines: RegistrarEntregaLineInput[],
  evidenciaIds: string[],
  creadoPor: string
): Promise<RegistrarEntregaResult> {
  return httpClient.request<RegistrarEntregaResult>({
    method: 'POST',
    path: `/deliveries/${deliveryId}/notes`,
    body: { empresaId, idempotencyKey, lines, evidenciaIds, creadoPor },
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

      // Resuelve motivoCodigo -> texto server-side (catalogo real, no
      // lo que mande el cliente) — 'OTRO' usa motivoOtroTexto, siempre
      // que venga cargado (ADR-010 seccion 5: el texto libre bajo
      // 'OTRO' queda guardado en la linea, no se descarta).
      const catalogoRechazo = await getMotivoCatalog(empresaId, 'rechazo');
      for (const line of lines) {
        if (line.cantidadRechazada > 0 && !line.motivoCodigo) {
          return { success: false, reason: 'motivo-invalido' as const };
        }
        if (line.motivoCodigo === MOTIVO_OTRO_CODIGO && !line.motivoOtroTexto?.trim()) {
          return { success: false, reason: 'motivo-invalido' as const };
        }
      }

      return withIdempotency(idempotencyKey, async () => {
        const now = new Date().toISOString();
        // Tanda 10B (ADR-010 seccion 6, hallazgo de Fase A: conecta el
        // flag que Tanda 9 dejo declarado sin consumidor): si el motivo
        // elegido tiene disparaLogisticaInversa=true, la porcion
        // rechazada de la linea queda registrada como cantidad "en
        // transito de retorno" — el camion todavia no volvio al
        // deposito, asi que no es stock disponible todavia (eso lo
        // resuelve confirmarRecepcionDevolucion, fuera de alcance de
        // esta tanda), pero tampoco es invisible: existe como dato
        // propio en vez de perderse hasta que el camion vuelva.
        const noteLines: DeliveryNoteLine[] = lines.map((line) => {
          const motivoItem = catalogoRechazo.find((m) => m.codigo === line.motivoCodigo);
          const motivoTexto = line.motivoCodigo === MOTIVO_OTRO_CODIGO ? line.motivoOtroTexto : motivoItem?.descripcion;
          const disparaRetorno = line.cantidadRechazada > 0 && (motivoItem?.disparaLogisticaInversa ?? false);
          return {
            orderLineId: line.orderLineId,
            cantidadOfrecida: line.cantidadEntregada + line.cantidadRechazada,
            cantidadEntregada: line.cantidadEntregada,
            cantidadRechazada: line.cantidadRechazada,
            motivoCodigo: line.motivoCodigo,
            motivoRechazo: motivoTexto,
            cantidadEnTransitoDeRetorno: disparaRetorno ? line.cantidadRechazada : 0,
          };
        });

        const note: DeliveryNote = {
          id: asDeliveryNoteId(`remito-${Date.now()}`),
          orderId: delivery.orderId,
          deliveryId,
          fecha: now,
          lines: noteLines,
          evidenciaIds,
          creadoEn: now,
          creadoPor,
        };

        deliveryNotesStore = [...deliveryNotesStore, note];
        deliveriesStore = deliveriesStore.map((d) => (d.id === deliveryId ? appendHistoryEvent(d, 'FINALIZADO', creadoPor, now) : d));

        // Fix post-Fase 2 (hallazgo A15#3 reintroducido): antes era
        // `void applyDeliveryToOrderLines(...)`, sin await ni catch —
        // la funcion devolvia `success: true` sin esperar a que la
        // propagacion terminara, asi que un fallo ahi (ej. el pedido ya
        // no existe) quedaba silencioso: el usuario veia "Entrega
        // registrada correctamente" con las lineas del pedido sin
        // actualizar. Ahora se espera, y si falla, el resultado lo dice
        // (`propagation-failed`) en vez de mentir un exito.
        //
        // El remito y la transicion a FINALIZADO de arriba NO se
        // deshacen si esto falla: son el hecho fisico ya ocurrido (la
        // entrega paso, el remito se emitio) — revertirlos simularia
        // que nunca pasaron. Lo que falla es la contabilidad derivada
        // (cuanto quedo pendiente en el pedido), que necesita
        // corregirse — quien llama a esta funcion ve
        // `reason: 'propagation-failed'` y puede avisar/reintentar en
        // vez de cerrar el flujo como si nada hubiera fallado.
        try {
          await applyDeliveryToOrderLines(
            delivery.orderId,
            lines.filter((l) => l.cantidadEntregada > 0).map((l) => ({ orderLineId: l.orderLineId, cantidadEntregada: l.cantidadEntregada }))
          );
        } catch {
          return { success: false, note, reason: 'propagation-failed' as const };
        }

        return { success: true, note };
      });
    },
  });
}

// Historial de remitos de una entrega puntual — usado por el panel de
// historial de la UI (Tanda 8). No pasa por httpClient: es una
// lectura chica y sincronica sobre un array que ya vive en memoria del
// navegador (no hay latencia real que simular para esto, a diferencia
// de un GET real).
//
// empresaId explicito por regla 3.5 del protocolo, aunque el cuerpo no
// lo use para filtrar: es un punto de entrada real (lo llama
// DeliveryHistoryModal.tsx directo, no es una llamada interna
// servidor-a-servidor), y el mock de una sola empresa no necesita
// aplicarlo — mismo criterio ya usado en el resto del proyecto para
// parametros aceptados por contrato pero no aplicados al mock.
export function getDeliveryNotesForDelivery(empresaId: string, deliveryId: DeliveryId): DeliveryNote[] {
  void empresaId;
  return deliveryNotesStore.filter((note) => note.deliveryId === deliveryId);
}

// ============================================================
// Alta de Delivery desde un pedido (Tanda 9, hallazgo A15#1 — el item
// mas importante de esta tanda: hasta ahora no existia ninguna forma
// de que un pedido generara una entrega, las 18 del mock eran
// estaticas). Llamada "servidor a servidor" hacia
// orders.service.ts#getOrderById (misma direccion ya establecida,
// deliveries -> orders, nunca al reves — ver applyDeliveryToOrderLines
// mas arriba) para tomar clientName/direccion del pedido en vez de que
// el formulario los vuelva a tipear.
//
// collectionAmount/date/estimatedTime/zone/priority/branchId quedan a
// cargo de quien crea la entrega (formulario): no se derivan del
// pedido porque un pedido puede repartirse en mas de una entrega
// (hallazgo A15#4) y el monto a cobrar por CADA una no es un dato que
// el pedido tenga partido por entrega — inventar esa division esta
// fuera del alcance de esta tanda (eje financiero, ADR-010 seccion 1).
// ============================================================

export interface CreateDeliveryInput {
  branchId: Branch['id'];
  date: string; // ISO date (yyyy-MM-dd)
  estimatedTime: string;
  zone: 'Norte' | 'Centro' | 'Sur';
  priority: 'high' | 'medium' | 'low';
  collectionAmount: number;
}

export type CreateDeliveryReason = 'order-not-found' | 'order-not-confirmado';

export interface CreateDeliveryResult {
  success: boolean;
  delivery?: Delivery;
  reason?: CreateDeliveryReason;
}

export async function createDelivery(
  empresaId: string,
  idempotencyKey: string,
  orderId: OrderId,
  input: CreateDeliveryInput,
  quien: string
): Promise<CreateDeliveryResult> {
  return httpClient.request<CreateDeliveryResult>({
    method: 'POST',
    path: '/deliveries',
    body: { empresaId, idempotencyKey, orderId, ...input },
    mock: async () => {
      const order = await getOrderById(empresaId, orderId);
      if (!order) {
        return { success: false, reason: 'order-not-found' as const };
      }
      // Solo un pedido con el eje comercial en 'Confirmado' genera
      // entrega — 'Borrador'/'Cancelado' no salen a reparto (ADR-010
      // seccion 1: se valida contra `comercial`, el campo real, nunca
      // contra el `status` deprecado).
      if (order.comercial !== 'Confirmado') {
        return { success: false, reason: 'order-not-confirmado' as const };
      }

      return withIdempotency(idempotencyKey, () => {
        const now = new Date().toISOString();
        const firstEvent: DeliveryHistoryEvent = {
          id: asDeliveryHistoryEventId(`dh-${Date.now()}-0`),
          desde: null,
          hasta: 'CREADO',
          quien,
          cuando: now,
        };
        const delivery: Delivery = {
          id: asDeliveryId(`del-${Date.now()}`),
          orderId,
          branchId: input.branchId,
          clientName: order.clientName,
          address: order.clientAddress,
          date: input.date,
          estimatedTime: input.estimatedTime,
          status: 'CREADO',
          zone: input.zone,
          priority: input.priority,
          collectionAmount: input.collectionAmount,
          historial: [firstEvent],
          reprogramaciones: [],
        };

        deliveriesStore = [...deliveriesStore, delivery];
        return { success: true, delivery: { ...delivery, allowedTransitions: computeAllowedTransitions(delivery.status) } };
      });
    },
  });
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
export async function getDeliveriesForOrder(empresaId: string, orderId: OrderId, signal?: AbortSignal): Promise<Delivery[]> {
  return httpClient.request<Delivery[]>({
    method: 'GET',
    path: `/orders/${orderId}/deliveries`,
    params: { empresaId },
    signal,
    mock: () => structuredClone(deliveriesStore.filter((d) => d.orderId === orderId)),
  });
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
export async function getDeliveriesByIds(empresaId: string, deliveryIds: DeliveryId[], signal?: AbortSignal): Promise<Delivery[]> {
  return httpClient.request<Delivery[]>({
    method: 'GET',
    path: '/deliveries/by-ids',
    params: { empresaId, ids: deliveryIds.join(',') },
    signal,
    mock: () => structuredClone(deliveriesStore.filter((d) => deliveryIds.includes(d.id))),
  });
}
