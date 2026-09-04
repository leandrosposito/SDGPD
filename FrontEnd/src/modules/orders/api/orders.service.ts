import type { Order, OrderStatus } from '@/shared/types/order.types';
import type { PageQuery, PageResult, DateRangeQueryFilters } from '@/shared/types/pagination.types';
import { ORDERS_MOCK_DATA } from '@/data/mock/orders.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import type { OrderDTO, OrdersPageDTO, OrdersAggregatesDTO } from './dto';
import { orderFromDTO, orderToDTO, orderFormInputToDTO, type OrderFormInput } from './mapper';

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

function nextOrderId(): string {
  return `ord-${Date.now()}`;
}

function nextOrderNumber(): string {
  return `PED-${Date.now().toString().slice(-5)}`;
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
          nombre: input.clientName,
          direccion: input.clientAddress,
          zona: input.clientZone,
        },
        vendedor: input.sellerName,
        estado: 'pending',
        origen: 'manual',
        forma_pago: input.paymentMethod,
        importes: {
          subtotal: input.subtotal,
          descuento: input.discount,
          impuesto: input.tax,
          total: input.totalAmount,
        },
        notas: input.notes,
        items: input.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          nombre: item.name,
          cantidad: item.quantity,
          precio_unitario: item.unitPrice,
          subtotal: item.subtotal,
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

export type OrderStatusTransitionReason = 'not-found' | 'terminal-status';

export interface OrderStatusTransitionResult {
  success: boolean;
  orderId: string;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
  reason?: OrderStatusTransitionReason;
}

export async function advanceOrderStatus(orderId: string): Promise<OrderStatusTransitionResult> {
  return httpClient.request<OrderStatusTransitionResult>({
    method: 'PUT',
    path: `/orders/${orderId}/advance`,
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

// Cancela desde CUALQUIER estado, sin restriccion — mismo
// comportamiento que handleCancel en OrdersPage.tsx antes de esta
// tanda (a diferencia de purchaseOrders, que sí valida transiciones
// válidas para cancelar).
export async function cancelOrder(orderId: string): Promise<OrderStatusTransitionResult> {
  return httpClient.request<OrderStatusTransitionResult>({
    method: 'PUT',
    path: `/orders/${orderId}/cancel`,
    mock: () => {
      const existing = ordersDTOStore.find((dto) => dto.id === orderId);
      if (!existing) {
        return { success: false, orderId, reason: 'not-found' };
      }
      const previousStatus = existing.estado;
      ordersDTOStore = ordersDTOStore.map((dto) => (dto.id === orderId ? { ...dto, estado: 'cancelled' } : dto));
      return { success: true, orderId, previousStatus, newStatus: 'cancelled' };
    },
  });
}
