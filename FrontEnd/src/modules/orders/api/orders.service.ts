import type { Order, OrderStatus } from '@/shared/types/order.types';
import type { OrderId, OrderLineId } from '@/shared/types/ids.types';
import { asOrderId } from '@/shared/types/ids.types';
import type { PageQuery, PageResult, DateRangeQueryFilters, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { ORDERS_MOCK_DATA } from '@/data/mock/orders.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import type { OrderDTO, OrdersPageDTO, OrdersAggregatesDTO } from './dto';
import { orderFromDTO, orderToDTO, orderFormInputToDTO, type OrderFormInput } from './mapper';
import type { OrderProjectionForAggregation } from '@/modules/dashboard/api/dashboardAggregates';
import { getActiveDeliveriesForOrder } from '@/modules/logistics/services/deliveries.service';

export type { OrderFormInput };

// ============================================================
// orders.service — Único punto del proyecto que habla con httpClient
// para Pedidos (Tanda 3a de escalabilidad). Todo lo que sale de acá ya
// está en forma de dominio (Order) — OrderDTO/OrdersPageDTO nunca
// cruzan este archivo hacia afuera. Segunda plantilla del proyecto
// (la primera fue suppliers, Tanda 1) — a diferencia de esa, orders NO
// tenía ningún service previo (leía data/mock/orders.data.ts directo
// desde useState en OrdersPage.tsx), así que esta migración resuelve
// además el ítem 8 de PENDIENTES.md: las mutaciones ahora sobreviven
// al desmontaje del componente porque viven en este store de módulo,
// no en el estado de React.
//
// Sin branchId (confirmado explícitamente con el usuario antes de
// implementar, no asumido — ver docs/DECISIONES_TECNICAS.md): un
// pedido es de la empresa, no de una sucursal. `Order` no tiene ningún
// campo de sucursal hoy; `activeBranchId` solo se usa en
// OrderProductsSection.tsx para consultar stock disponible al armar
// el pedido, nunca se persiste en el pedido en sí.
// ============================================================

export interface OrdersQueryFilters extends DateRangeQueryFilters {
  // Todo método de este service recibe empresaId explícito desde
  // ahora (mismo criterio que suppliers/products/clients) — hoy el
  // mock no filtra por él de verdad (una sola empresa), pero el
  // contrato ya lo exige para el día que exista backend real.
  empresaId: string;
  search?: string;
  status?: OrderStatus;
  seller?: string;
  paymentMethod?: string;
}

export type OrdersSortField = 'date' | 'totalAmount' | 'clientName';

// Agregados (P3, DECISIONES_TECNICAS.md): reemplaza el cálculo que
// hacía OrderKpis.tsx en memoria sobre el array completo de pedidos —
// una vez paginado, ese array pasa a ser solo la página actual, así
// que el cálculo tiene que vivir server-side. Se calculan sobre el
// scope filtrado por búsqueda/vendedor/forma de pago/fecha, SIN el
// filtro de estado (mismo criterio que PurchaseOrdersAggregates/
// DeliveryAggregates: la faceta que el usuario togglea no debe
// cambiar los totales de las otras facetas). Antes de esta tanda,
// OrderKpis ignoraba TODOS los filtros (siempre mostraba el total de
// la empresa); esto es una alineación consciente con la convención ya
// establecida en el resto del proyecto, no un cambio accidental.
export interface OrdersAggregates {
  todayCount: number;
  pendingCount: number;
  preparingCount: number;
  dispatchedCount: number;
  todayBilling: number;
}

// ------------------------------------------------------------
// "Servidor" mock — espacio DTO, sembrado una sola vez desde
// data/mock/orders.data.ts (dominio) vía orderToDTO. Reasignado
// (nunca mutado in-place) en cada escritura, mismo patrón que el
// resto de services/*.ts.
// ------------------------------------------------------------
let ordersDTOStore: OrderDTO[] = ORDERS_MOCK_DATA.map(orderToDTO);

// Fecha "hoy" simulada (preexistente en OrderKpis.tsx antes de esta
// tanda, movida acá tal cual — no se corrige en esta migración,
// que es sobre paginación/cache, no sobre esta lógica de negocio):
// en un sistema real se usaría la fecha actual real.
const FAKE_TODAY = '2026-06-13';

function matchesFilters(dto: OrderDTO, filters: OrdersQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase();
  const matchesSearch = !search || dto.cliente.nombre.toLowerCase().includes(search);
  const matchesSeller = !filters.seller || dto.vendedor === filters.seller;
  const matchesPayment = !filters.paymentMethod || dto.forma_pago === filters.paymentMethod;
  const day = dto.fecha.slice(0, 10);
  const matchesDateFrom = !filters.dateFrom || day >= filters.dateFrom;
  const matchesDateTo = !filters.dateTo || day <= filters.dateTo;
  return matchesSearch && matchesSeller && matchesPayment && matchesDateFrom && matchesDateTo;
}

function compareOrders(a: OrderDTO, b: OrderDTO, field: OrdersSortField): number {
  switch (field) {
    case 'totalAmount':
      return a.importes.total - b.importes.total;
    case 'clientName':
      return a.cliente.nombre.localeCompare(b.cliente.nombre);
    case 'date':
    default:
      return a.fecha.localeCompare(b.fecha);
  }
}

// Compartida entre el resolver paginado y el cómputo de agregados (no
// se duplica filtro+orden) — igual criterio que filterAndSortSuppliers.
function filterAndSortOrders(
  filters: OrdersQueryFilters,
  sort: { field: OrdersSortField; direction: 'asc' | 'desc' } | undefined
): OrderDTO[] {
  const inScope = ordersDTOStore.filter((dto) => matchesFilters(dto, filters));
  const sortField = sort?.field ?? 'date';
  const direction = sort?.direction ?? 'desc'; // pedidos mas recientes primero, mismo orden que el mock
  return [...inScope].sort((a, b) => {
    const cmp = compareOrders(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id: evita que el mismo pedido aparezca en
    // dos paginas o en ninguna si el campo de orden empata.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

// Devuelve forma DTO (snake_case) a proposito: este helper opera del
// lado "servidor" del mock (sobre OrderDTO[]) — el mapeo a la forma de
// dominio (OrdersAggregates) pasa por getOrdersPage, igual que el
// resto de la respuesta paginada.
function computeAggregates(inScope: OrderDTO[]): OrdersAggregatesDTO {
  const todayScope = inScope.filter((dto) => dto.fecha.startsWith(FAKE_TODAY));
  return {
    pedidos_hoy: todayScope.length,
    pendientes: inScope.filter((dto) => dto.estado === 'pending').length,
    preparando: inScope.filter((dto) => dto.estado === 'preparing').length,
    despachados: inScope.filter((dto) => dto.estado === 'dispatched').length,
    facturacion_hoy: todayScope
      .filter((dto) => dto.estado !== 'cancelled')
      .reduce((sum, dto) => sum + dto.importes.total, 0),
  };
}

function resolveMockOrdersPage(query: PageQuery<OrdersQueryFilters, OrdersSortField>): OrdersPageDTO {
  // Agregados sobre el scope SIN el filtro de estado (ver comentario
  // de OrdersAggregates) — se calcula antes de aplicar ese filtro.
  const inScopeWithoutStatus = ordersDTOStore.filter((dto) =>
    matchesFilters(dto, { ...query.filters, status: undefined })
  );
  const aggregates = computeAggregates(inScopeWithoutStatus);

  const sorted = filterAndSortOrders(query.filters, query.sort).filter(
    (dto) => !query.filters.status || dto.estado === query.filters.status
  );

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const start = (safePage - 1) * query.pageSize;

  return {
    data: sorted.slice(start, start + query.pageSize),
    meta: { total, page: safePage, page_size: query.pageSize, aggregates },
  };
}

// fetchPage de usePagedQuery — firma exacta (query, signal?), nombre
// estable (usePagedQuery usa `.name` para identificar la query en el
// cache de TanStack Query desde Tanda 2, ver GUIA_MIGRACION_MODULO.md).
export async function getOrdersPage(
  query: PageQuery<OrdersQueryFilters, OrdersSortField>,
  signal?: AbortSignal
): Promise<PageResult<Order, OrdersAggregates>> {
  const pageDTO = await httpClient.request<OrdersPageDTO>({
    method: 'GET',
    path: '/orders',
    params: {
      empresaId: query.filters.empresaId,
      search: query.filters.search,
      status: query.filters.status,
      seller: query.filters.seller,
      paymentMethod: query.filters.paymentMethod,
      dateFrom: query.filters.dateFrom,
      dateTo: query.filters.dateTo,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => resolveMockOrdersPage(query),
  });

  return {
    items: pageDTO.data.map(orderFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
    aggregates: {
      todayCount: pageDTO.meta.aggregates.pedidos_hoy,
      pendingCount: pageDTO.meta.aggregates.pendientes,
      preparingCount: pageDTO.meta.aggregates.preparando,
      dispatchedCount: pageDTO.meta.aggregates.despachados,
      todayBilling: pageDTO.meta.aggregates.facturacion_hoy,
    },
  };
}

// Exportar (tarea transversal, ADR-004): TODO lo que matchea filtros+
// estado, sin paginar, hasta MAX_EXPORT_ROWS. Reusa filterAndSortOrders
// (misma logica que getOrdersPage, no duplicada) + el mismo filtro de
// estado que resolveMockOrdersPage aplica DESPUES de filterAndSortOrders
// (el estado no participa de matchesFilters a proposito, ver comentario
// de OrdersAggregates mas arriba).
export async function exportOrders(
  filters: OrdersQueryFilters,
  sort?: { field: OrdersSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<Order>> {
  return httpClient.request<ExportResult<OrderDTO>>({
    method: 'GET',
    path: '/orders/export',
    params: {
      empresaId: filters.empresaId,
      search: filters.search,
      status: filters.status,
      seller: filters.seller,
      paymentMethod: filters.paymentMethod,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    mock: () => {
      const sorted = filterAndSortOrders(filters, sort).filter(
        (dto) => !filters.status || dto.estado === filters.status
      );
      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS);
      return { items: structuredClone(items), truncated };
    },
  }).then((result) => ({ items: result.items.map(orderFromDTO), truncated: result.truncated }));
}

function nextOrderId(): string {
  // Devuelve string (no OrderId): OrderDTO.id es la forma "de red"
  // (plano), el branding ocurre en el mapper al volver a dominio
  // (orderFromDTO) — mismo criterio que el resto de los ids DTO.
  return `ord-${Date.now()}`;
}

function nextOrderNumber(): string {
  return `PED-${Date.now().toString().slice(-5)}`;
}

// Id de linea (OrderLineId, Tanda 5/ADR-006) asignado por el service,
// nunca por el cliente — `index` evita colisiones entre lineas del
// mismo pedido creadas en el mismo milisegundo (Date.now() solo).
function nextOrderLineId(index: number): string {
  return `oi-${Date.now()}-${index}`;
}

// RF-PED-001: alta manual (CreateOrderModal). `source` siempre
// 'manual' acá — los pedidos con `source: 'mobile'` del mock simulan
// llegar por otro canal (la app de vendedores), no por este formulario.
export async function createOrder(empresaId: string, input: OrderFormInput): Promise<Order> {
  const dto = await httpClient.request<OrderDTO>({
    method: 'POST',
    path: '/orders',
    body: { empresaId, ...orderFormInputToDTO(input) },
    mock: () => {
      if (input.items.length === 0) {
        throw new ApiError(400, 'CLIENT_ERROR', 'El pedido necesita al menos un producto.');
      }
      const now = new Date().toISOString();
      const newDTO: OrderDTO = {
        id: nextOrderId(),
        numero_pedido: nextOrderNumber(),
        fecha: now,
        cliente: {
          id: input.clientId,
          nombre: input.clientName,
          direccion: input.clientAddress,
          zona: input.clientZone,
        },
        vendedor: input.sellerName,
        estado: 'pending',
        // Tanda 9 (ADR-010 seccion 1): ningun flujo de UI crea pedidos
        // en 'Borrador' hoy — CreateOrderModal siempre confirma directo.
        estado_comercial: 'Confirmado',
        origen: 'manual',
        forma_pago: input.paymentMethod,
        importes: {
          subtotal: input.subtotal,
          descuento: input.discount,
          impuesto: input.tax,
          total: input.totalAmount,
        },
        notas: input.notes,
        items: input.items.map((item, index) => ({
          id: nextOrderLineId(index),
          sku: item.sku,
          nombre: item.name,
          cantidad: item.quantity,
          precio_unitario: item.unitPrice,
          subtotal: item.subtotal,
          cantidad_entregada: 0,
        })),
        historial: [{ id: `h-${Date.now()}`, fecha: now, estado: 'pending', descripcion: 'Pedido creado manualmente' }],
      };
      ordersDTOStore = [newDTO, ...ordersDTOStore];
      return newDTO;
    },
  });
  return orderFromDTO(dto);
}

// Flujo lineal de estados (mismo comportamiento que STATUS_FLOW en
// OrdersPage.tsx antes de esta tanda) — más simple que
// VALID_TRANSITIONS de purchaseOrders.service.ts porque orders no
// tenía una tabla de transiciones previa, solo un "siguiente estado".
const ORDER_STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'dispatched',
  dispatched: 'delivered',
  delivered: 'invoiced',
};

// 'has-active-deliveries' solo lo produce cancelOrder — advanceOrderStatus
// nunca lo devuelve, pero comparten el mismo tipo de resultado
// (OrderStatusTransitionResult) desde antes de este fix, no vale la
// pena partirlo en dos tipos para una sola razon nueva.
export type OrderStatusTransitionReason = 'not-found' | 'terminal-status' | 'has-active-deliveries';

export interface OrderStatusTransitionResult {
  success: boolean;
  orderId: string;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
  reason?: OrderStatusTransitionReason;
}

export async function advanceOrderStatus(empresaId: string, orderId: string): Promise<OrderStatusTransitionResult> {
  return httpClient.request<OrderStatusTransitionResult>({
    method: 'PUT',
    path: `/orders/${orderId}/advance`,
    params: { empresaId },
    mock: () => {
      const existing = ordersDTOStore.find((dto) => dto.id === orderId);
      if (!existing) {
        return { success: false, orderId, reason: 'not-found' };
      }
      const nextStatus = ORDER_STATUS_FLOW[existing.estado];
      if (!nextStatus) {
        return { success: false, orderId, previousStatus: existing.estado, reason: 'terminal-status' };
      }
      const previousStatus = existing.estado;
      ordersDTOStore = ordersDTOStore.map((dto) => (dto.id === orderId ? { ...dto, estado: nextStatus } : dto));
      return { success: true, orderId, previousStatus, newStatus: nextStatus };
    },
  });
}

// Cancela desde CUALQUIER estado, sin restriccion de `estado`/
// `estado_comercial` — mismo comportamiento que handleCancel en
// OrdersPage.tsx antes de esta tanda (a diferencia de purchaseOrders,
// que sí valida transiciones válidas para cancelar). La UNICA
// restriccion real es que no tenga una entrega activa (fix del
// hallazgo ALTO de Fase 3, Tanda 9: antes esta funcion no consultaba
// deliveriesStore para nada, un pedido con una entrega en curso podia
// quedar Cancelado mientras la entrega seguia y cobraba
// collectionAmount).
export async function cancelOrder(empresaId: string, orderId: string): Promise<OrderStatusTransitionResult> {
  return httpClient.request<OrderStatusTransitionResult>({
    method: 'PUT',
    path: `/orders/${orderId}/cancel`,
    params: { empresaId },
    mock: () => {
      const existing = ordersDTOStore.find((dto) => dto.id === orderId);
      if (!existing) {
        return { success: false, orderId, reason: 'not-found' };
      }
      if (getActiveDeliveriesForOrder(asOrderId(orderId)).length > 0) {
        return { success: false, orderId, previousStatus: existing.estado, reason: 'has-active-deliveries' };
      }
      const previousStatus = existing.estado;
      // Tanda 9 (ADR-010 seccion 1): cancelar SI es un evento del eje
      // comercial real — a diferencia de advanceOrderStatus (que sigue
      // escribiendo solo el `estado` legado, ver order.types.ts), esta
      // mutacion escribe los dos: `estado` porque el resto de la UI
      // todavia lo lee (no migro esta tanda), `estado_comercial` porque
      // es, genuinamente, la fuente nueva para este hecho.
      ordersDTOStore = ordersDTOStore.map((dto) =>
        dto.id === orderId ? { ...dto, estado: 'cancelled', estado_comercial: 'Cancelado' } : dto
      );
      return { success: true, orderId, previousStatus, newStatus: 'cancelled' };
    },
  });
}

// ------------------------------------------------------------
// Proyeccion minima para agregados de OTRO service (Tanda 7 de la
// corrida completa, dashboardAggregates.service.ts) — NO es un punto
// de entrada de red (no pasa por httpClient): es una lectura interna
// "servidor a servidor" del propio store en memoria de este modulo,
// nunca expuesta a un componente ni cruza hacia afuera del tablero.
// Devuelve solo los 4 campos que las agrupaciones de
// dashboardAggregates.ts necesitan, no el DTO completo.
// ------------------------------------------------------------
export function getOrdersSnapshotForAggregation(): OrderProjectionForAggregation[] {
  return ordersDTOStore.map((dto) => ({
    id: asOrderId(dto.id),
    status: dto.estado,
    date: dto.fecha,
    zone: dto.cliente.zona,
    totalAmount: dto.importes.total,
  }));
}

// ------------------------------------------------------------
// getOrderById — lectura puntual de UN pedido completo (Tanda 8,
// corrida completa): lo necesita el modal de "Registrar entrega" de
// Logistica para mostrar las lineas del pedido (pedida/entregada/
// pendiente) antes de cargar un remito. A diferencia de
// getOrdersSnapshotForAggregation (lectura interna servidor-a-servidor,
// nunca cruza hacia un componente), esta SI la consume la UI
// directamente — pasa por httpClient como cualquier otro endpoint de
// lectura del proyecto.
// ------------------------------------------------------------
export async function getOrderById(
  empresaId: string,
  orderId: OrderId,
  signal?: AbortSignal
): Promise<Order | undefined> {
  const dto = await httpClient.request<OrderDTO | undefined>({
    method: 'GET',
    path: `/orders/${orderId}`,
    params: { empresaId },
    signal,
    mock: () => ordersDTOStore.find((d) => d.id === orderId),
  });
  return dto ? orderFromDTO(dto) : undefined;
}

export interface OrderLineDeliveryDelta {
  orderLineId: OrderLineId;
  cantidadEntregada: number;
}

// ------------------------------------------------------------
// applyDeliveryToOrderLines — aplica un remito (deliveries.service.ts,
// Tanda 8/ADR-001) a las lineas del pedido: ACUMULA (no reemplaza)
// `cantidadEntregada` de cada linea afectada. Es una llamada
// "servidor a servidor" (deliveries.service.ts, otro modulo, invoca
// esta funcion) — mismo criterio que getOrdersSnapshotForAggregation:
// la variable de store (`ordersDTOStore`) nunca sale de este archivo,
// solo funciones que la leen/mutan bajo control de orders.service.ts.
// No pasa por httpClient a proposito: es el equivalente a que un
// backend real invoque otro modulo interno propio, no una peticion de
// red — httpClient existe para el trafico cliente-servidor, no para
// llamadas entre dos servicios del mismo "servidor" mock.
// ------------------------------------------------------------
export async function applyDeliveryToOrderLines(orderId: OrderId, deltas: OrderLineDeliveryDelta[]): Promise<Order> {
  const existing = ordersDTOStore.find((dto) => dto.id === orderId);
  if (!existing) {
    throw new ApiError(404, 'CLIENT_ERROR', `No se encontro el pedido ${orderId} para aplicar el remito.`);
  }

  const deltaByLine = new Map(deltas.map((d) => [d.orderLineId as string, d.cantidadEntregada]));

  const updated: OrderDTO = {
    ...existing,
    items: existing.items.map((item) => {
      const delta = deltaByLine.get(item.id);
      if (!delta) return item;
      return { ...item, cantidad_entregada: item.cantidad_entregada + delta };
    }),
  };

  ordersDTOStore = ordersDTOStore.map((dto) => (dto.id === orderId ? updated : dto));

  return orderFromDTO(updated);
}
