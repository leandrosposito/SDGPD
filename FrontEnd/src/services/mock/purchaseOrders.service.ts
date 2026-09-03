import type { Supplier } from '@/shared/types/supplier.types';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import type {
  Currency,
  CreatePurchaseOrderInput,
  CreatePurchaseOrderResult,
  GeneratePurchaseOrderFromSuggestionInput,
  GeneratePurchaseOrderResult,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  PurchaseOrderStatusAggregate,
  PurchaseOrderTransitionResult,
  PurchaseOrdersAggregates,
  PurchaseOrdersQueryFilters,
  PurchaseOrdersSortField,
} from '@/shared/types/purchaseOrder.types';
import { PURCHASE_ORDERS_MOCK_DATA } from '@/data/mock/purchaseOrders.data';

// ============================================================
// PURCHASE ORDERS SERVICE (Compras) — O1-O10, DECISIONES_TECNICAS.md.
// Ubicacion: services/mock/ en vez de modules/compras/services/ (3.3):
// 5 de los 6 servicios mock del proyecto viven aca (clients, dashboard,
// products, session, suppliers); solo deliveries.service.ts quedo en
// modules/logistics/services/ como excepcion preexistente, sin
// reconciliar (fuera de alcance de esta tarea, O11). Se sigue la
// convencion mayoritaria y mas reciente, no la excepcion.
//
// Simula llamadas asincronicas (delay + structuredClone), con
// clientsStore-style module-level array reasignado (no mutado) en cada
// escritura — mismo patron que clients.service.ts/products.service.ts.
// ============================================================

const SIMULATED_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let purchaseOrdersStore: PurchaseOrder[] = structuredClone(PURCHASE_ORDERS_MOCK_DATA);

export class PurchaseOrderServiceError extends Error {}

// Total de una orden (O2): SIEMPRE derivado de sus lineas, nunca un
// campo propio. Se llama tanto para construir agregados (server-side,
// sobre TODO el scope) como para el detalle de una orden puntual (ahi
// no es un agregado sobre `items` de una pagina — P3 no aplica a
// calcular el total de las propias lineas de UNA orden ya cargada
// completa, igual que OrderItemsTable ya calculaba quantity*unitPrice
// por fila antes de esta tarea).
export function computePurchaseOrderTotal(lines: PurchaseOrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

function matchesSearch(orderId: string, search: string | undefined): boolean {
  if (!search || !search.trim()) return true;
  return orderId.toLowerCase().includes(search.trim().toLowerCase());
}

// dateFrom/dateTo (DateRangeFilter, tarea transversal): comparan solo
// la porcion yyyy-MM-dd de `createdAt` (ISO datetime completo) contra
// los dos limites (ISO date puro) — asi una orden creada HOY a
// cualquier hora cae dentro de un rango cuyo `dateTo` es hoy, en vez de
// quedar afuera por la parte de hora del datetime.
function isWithinDateRange(dateISO: string, dateFrom: string | undefined, dateTo: string | undefined): boolean {
  const day = dateISO.slice(0, 10);
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}

// Filtro compartido entre getPurchaseOrdersPage y exportPurchaseOrders
// (no se duplica la logica de filtrado entre paginado y export, ver
// DECISIONES_TECNICAS.md). Incluye TODOS los filtros salvo `status`
// (que se aplica aparte, ver O8: los agregados por estado necesitan el
// scope SIN ese filtro).
function filterOrdersInScope(filters: PurchaseOrdersQueryFilters): PurchaseOrder[] {
  return purchaseOrdersStore.filter(
    (o) =>
      matchesSearch(o.id, filters.search) &&
      (!filters.supplierId || o.supplierId === filters.supplierId) &&
      (!filters.branchId || o.branchId === filters.branchId) &&
      isWithinDateRange(o.createdAt, filters.dateFrom, filters.dateTo)
  );
}

function sortOrders(
  orders: PurchaseOrder[],
  sort: { field: PurchaseOrdersSortField; direction: 'asc' | 'desc' } | undefined
): PurchaseOrder[] {
  const sortField = sort?.field ?? 'createdAt';
  const direction = sort?.direction ?? 'desc';
  return [...orders].sort((a, b) => {
    const cmp = compareOrders(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.3): un orden ambiguo hace que la
    // misma OC aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

function compareOrders(a: PurchaseOrder, b: PurchaseOrder, field: PurchaseOrdersSortField): number {
  switch (field) {
    case 'total':
      return computePurchaseOrderTotal(a.lines) - computePurchaseOrderTotal(b.lines);
    case 'createdAt':
    default:
      return a.createdAt.localeCompare(b.createdAt);
  }
}

const ALL_STATUSES: readonly PurchaseOrderStatus[] = ['draft', 'sent', 'received', 'cancelled'];

// Agregados por estado (O8): clave compuesta estado:moneda, mismo
// criterio que AgingBucketAggregate en clients.service.ts. Se calculan
// sobre el scope de busqueda/proveedor/sucursal PERO sin aplicar el
// filtro de estado (mismo motivo que el filtro de tramo en clientes: el
// estado es la faceta que el usuario togglea, no debe cambiar los
// totales de las otras facetas al elegir una).
function computeAggregates(orders: PurchaseOrder[]): PurchaseOrdersAggregates {
  const totals = new Map<string, PurchaseOrderStatusAggregate>();

  for (const order of orders) {
    const key = `${order.status}:${order.currency}`;
    const current = totals.get(key) ?? { status: order.status, currency: order.currency, count: 0, total: 0 };
    current.count += 1;
    current.total += computePurchaseOrderTotal(order.lines);
    totals.set(key, current);
  }

  const currencies = new Set<Currency>(
    orders.length > 0 ? orders.map((o) => o.currency) : (['ARS'] as Currency[])
  );
  const byStatus: PurchaseOrderStatusAggregate[] = [];
  for (const currency of currencies) {
    for (const status of ALL_STATUSES) {
      byStatus.push(totals.get(`${status}:${currency}`) ?? { status, currency, count: 0, total: 0 });
    }
  }
  return { byStatus };
}

export async function getPurchaseOrdersPage(
  query: PageQuery<PurchaseOrdersQueryFilters, PurchaseOrdersSortField>
): Promise<PageResult<PurchaseOrder, PurchaseOrdersAggregates>> {
  await delay(SIMULATED_DELAY_MS);

  const { filters, sort, page, pageSize } = query;

  const inScope = filterOrdersInScope(filters);

  const aggregates = computeAggregates(inScope);

  const filtered = filters.status ? inScope.filter((o) => o.status === filters.status) : inScope;

  const sorted = sortOrders(filtered, sort);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  return { items: structuredClone(items), total, page: safePage, pageSize, aggregates };
}

// Exportar (tarea transversal, DECISIONES_TECNICAS.md): TODO lo que
// matchea filtros+estado, sin paginar, hasta MAX_EXPORT_ROWS. Reusa
// filterOrdersInScope/sortOrders (misma logica que getPurchaseOrdersPage,
// no duplicada) — la unica diferencia es que no corta por pagina/pageSize,
// corta por el tope de export.
export async function exportPurchaseOrders(
  filters: PurchaseOrdersQueryFilters,
  sort?: { field: PurchaseOrdersSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<PurchaseOrder>> {
  await delay(SIMULATED_DELAY_MS);

  const inScope = filterOrdersInScope(filters);
  const filtered = filters.status ? inScope.filter((o) => o.status === filters.status) : inScope;
  const sorted = sortOrders(filtered, sort);

  const truncated = sorted.length > MAX_EXPORT_ROWS;
  const items = sorted.slice(0, MAX_EXPORT_ROWS);

  return { items: structuredClone(items), truncated };
}

// O3: consulta publica por supplierId — reemplaza a la lectura directa
// de Supplier.purchaseOrders[] (eliminado). No paginada a proposito
// (mismo criterio que getStockedProductsForBranch en products.service.ts,
// P8): es un panel de detalle de UN proveedor, no un listado general.
export async function getPurchaseOrdersBySupplierId(supplierId: Supplier['id']): Promise<PurchaseOrder[]> {
  await delay(SIMULATED_DELAY_MS);
  const orders = purchaseOrdersStore
    .filter((o) => o.supplierId === supplierId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return structuredClone(orders);
}

function nextOrderId(): string {
  return `po-${Date.now()}`;
}

function nextLineId(seed: number): string {
  return `pol-${Date.now()}-${seed}`;
}

// Alta manual (O4, desde el formulario migrado). status por defecto
// 'draft' — 'sent' solo si el formulario lo pide explicitamente
// ("Emitir Orden de Compra" vs "Guardar Borrador"). 'received'/
// 'cancelled' nunca se crean directo: son resultado de una transicion.
export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<CreatePurchaseOrderResult> {
  await delay(SIMULATED_DELAY_MS);

  if (!input.supplierId) {
    return { success: false, reason: 'invalid-supplier' };
  }
  if (input.lines.length === 0) {
    return { success: false, reason: 'no-lines' };
  }
  if (input.lines.some((l) => l.quantity <= 0 || l.unitPrice < 0)) {
    return { success: false, reason: 'invalid-line' };
  }

  const newOrder: PurchaseOrder = {
    id: nextOrderId(),
    supplierId: input.supplierId,
    branchId: input.branchId,
    currency: input.currency,
    status: input.status ?? 'draft',
    createdAt: new Date().toISOString(),
    lines: input.lines.map((l, i) => ({ ...l, id: nextLineId(i) })),
  };
  purchaseOrdersStore = [...purchaseOrdersStore, newOrder];
  return { success: true, order: structuredClone(newOrder) };
}

// O7: transiciones validas. Unica fuente de verdad — ni la vista ni
// ningun otro modulo decide que transicion es valida.
const VALID_TRANSITIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export async function updatePurchaseOrderStatus(
  orderId: PurchaseOrder['id'],
  nextStatus: PurchaseOrderStatus
): Promise<PurchaseOrderTransitionResult> {
  await delay(SIMULATED_DELAY_MS);

  const existing = purchaseOrdersStore.find((o) => o.id === orderId);
  if (!existing) {
    return { success: false, reason: 'order-not-found' };
  }
  if (!VALID_TRANSITIONS[existing.status].includes(nextStatus)) {
    return { success: false, reason: 'invalid-transition' };
  }

  const updated: PurchaseOrder = { ...existing, status: nextStatus };
  purchaseOrdersStore = purchaseOrdersStore.map((o) => (o.id === orderId ? updated : o));
  return { success: true, order: structuredClone(updated) };
}

// O9/O10: generar OC desde una sugerencia de stock critico. El input
// ya llega RESUELTO (supplierId real): la resolucion producto -> ID de
// proveedor pasa por Inventario antes de esta llamada (TabPurchases.tsx
// hace el join contra InventoryItem.supplierId), Compras no conoce el
// catalogo de productos ni de proveedores (R2) y no podria resolverlo
// por si sola.
//
// O10 (criterio de agrupacion, decidido y documentado en
// DECISIONES_TECNICAS.md): si ya existe una OC en estado 'draft' para
// el mismo proveedor+sucursal, la linea se agrega ahi (sumando cantidad
// si el producto ya tenia una linea) en vez de crear una orden nueva.
// Una vez que esa orden deja de ser 'draft' (se envia/recibe/cancela),
// el proximo "Generar OC" para ese proveedor+sucursal crea una nueva.
export async function generatePurchaseOrderFromSuggestion(
  input: GeneratePurchaseOrderFromSuggestionInput
): Promise<GeneratePurchaseOrderResult> {
  await delay(SIMULATED_DELAY_MS);

  if (!input.supplierId) {
    return { success: false, merged: false, reason: 'invalid-supplier' };
  }

  const existingDraft = purchaseOrdersStore.find(
    (o) => o.supplierId === input.supplierId && o.branchId === input.branchId && o.status === 'draft'
  );

  if (existingDraft) {
    const existingLine = existingDraft.lines.find((l) => l.productId === input.productId);
    const nextLines: PurchaseOrderLine[] = existingLine
      ? existingDraft.lines.map((l) =>
          l.productId === input.productId
            ? { ...l, quantity: l.quantity + input.quantity, unitPrice: input.unitPrice }
            : l
        )
      : [...existingDraft.lines, { id: nextLineId(existingDraft.lines.length), productId: input.productId, quantity: input.quantity, unitPrice: input.unitPrice }];

    const updated: PurchaseOrder = { ...existingDraft, lines: nextLines };
    purchaseOrdersStore = purchaseOrdersStore.map((o) => (o.id === existingDraft.id ? updated : o));
    return { success: true, merged: true, order: structuredClone(updated) };
  }

  const newOrder: PurchaseOrder = {
    id: nextOrderId(),
    supplierId: input.supplierId,
    branchId: input.branchId,
    currency: input.currency,
    status: 'draft',
    createdAt: new Date().toISOString(),
    lines: [{ id: nextLineId(0), productId: input.productId, quantity: input.quantity, unitPrice: input.unitPrice }],
  };
  purchaseOrdersStore = [...purchaseOrdersStore, newOrder];
  return { success: true, merged: false, order: structuredClone(newOrder) };
}
