import type { InventoryItem, ProductStock, StockedInventoryItem } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import { PRODUCT_STOCK_MOCK_DATA } from '@/data/mock/productStock.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';

// ============================================================
// PRODUCTS SERVICE — RF-PRD-001 (ABM Central de Productos)
// Pasa por httpClient (Tanda 2.5 de escalabilidad, ver
// DECISIONES_TECNICAS.md): timeout, reintentos, cancelacion real y
// VITE_MOCK_LATENCY_MS/VITE_MOCK_FAILURE_RATE/VITE_API_DEBUG ya no
// son exclusivos de suppliers.service.ts. Sigue devolviendo la misma
// forma de datos que antes (sin DTO/mapper — eso es Tanda 3): solo
// cambio el mecanismo de transporte.
//
// El "store" en memoria simula persistencia dentro de la sesion del
// navegador (no sobrevive a un refresh): permite que Alta/Modificacion/Baja
// se reflejen en sucesivas lecturas sin depender de que el componente
// mantenga el estado por su cuenta.
// ============================================================

let productsStore: InventoryItem[] = structuredClone(INVENTORY_MOCK_DATA.items);

// Stock por sucursal (E1/E4, DECISIONES_TECNICAS.md): entidad separada del
// catalogo, sin mutadores en esta tarea (movimientos/ajustes de stock
// quedan fuera de alcance) — se lee siempre de una copia, igual que
// productsStore, por si una tarea futura le agrega escritura.
const stockStore: ProductStock[] = structuredClone(PRODUCT_STOCK_MOCK_DATA);

export async function fetchProducts(signal?: AbortSignal): Promise<InventoryItem[]> {
  return httpClient.request<InventoryItem[]>({
    method: 'GET',
    path: '/products',
    signal,
    mock: () => structuredClone(productsStore),
  });
}

export async function createProduct(input: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  return httpClient.request<InventoryItem>({
    method: 'POST',
    path: '/products',
    body: input,
    mock: () => {
      const skuTaken = productsStore.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase());
      if (skuTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este SKU ya existe.');

      const barcodeTaken = productsStore.some((p) => p.barcode === input.barcode);
      if (barcodeTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este codigo de barras ya existe.');

      const newProduct: InventoryItem = { ...input, id: `inv-${Date.now()}` };
      productsStore = [...productsStore, newProduct];
      return structuredClone(newProduct);
    },
  });
}

export async function updateProduct(id: string, input: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  return httpClient.request<InventoryItem>({
    method: 'PUT',
    path: `/products/${id}`,
    body: input,
    mock: () => {
      const exists = productsStore.some((p) => p.id === id);
      if (!exists) throw new ApiError(404, 'CLIENT_ERROR', 'El producto que intenta editar ya no existe.');

      const skuTaken = productsStore.some(
        (p) => p.sku.toLowerCase() === input.sku.toLowerCase() && p.id !== id
      );
      if (skuTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este SKU ya existe.');

      const barcodeTaken = productsStore.some((p) => p.barcode === input.barcode && p.id !== id);
      if (barcodeTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este codigo de barras ya existe.');

      const updatedProduct: InventoryItem = { ...input, id };
      productsStore = productsStore.map((p) => (p.id === id ? updatedProduct : p));
      return structuredClone(updatedProduct);
    },
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return httpClient.request<void>({
    method: 'DELETE',
    path: `/products/${id}`,
    mock: () => {
      const exists = productsStore.some((p) => p.id === id);
      if (!exists) throw new ApiError(404, 'CLIENT_ERROR', 'El producto que intenta eliminar ya no existe.');

      productsStore = productsStore.filter((p) => p.id !== id);
    },
  });
}

// ============================================================
// STOCK POR SUCURSAL (E4, DECISIONES_TECNICAS.md) — ningun componente
// debe recorrer stockStore a mano; todo acceso pasa por estas funciones,
// que reciben branchId como parametro explicito (nunca leen
// useSessionStore aca, mismo criterio que deliveries.service.ts#D4).
// ============================================================

// Lectura puntual del registro de stock de un producto en una sucursal.
// undefined si el producto no esta dado de alta en esa sucursal (E5):
// no es un error, es un estado valido — quien llama decide como
// mostrarlo (ver getStockedProductsForBranch, que lo completa en 0).
export async function getStockForBranch(
  productId: InventoryItem['id'],
  branchId: Branch['id'],
  signal?: AbortSignal
): Promise<ProductStock | undefined> {
  return httpClient.request<ProductStock | undefined>({
    method: 'GET',
    path: `/products/${productId}/stock/${branchId}`,
    signal,
    mock: () => {
      const record = stockStore.find((s) => s.productId === productId && s.branchId === branchId);
      return record ? structuredClone(record) : undefined;
    },
  });
}

// Catalogo completo (RF-PRD-001) unido a su stock en una sucursal. Un
// producto sin registro en esa sucursal aparece con stock/minStock en 0
// (E5) en vez de quedar afuera de la lista — esta es la vista de
// "catalogo con su stock aca", no la de "stock cargado en esta sucursal"
// (para esa segunda vista ver getLowStockPage). No esta paginada (P8,
// tarea de paginacion server-side): TabStockCurrent no usaba el patron
// paginado antes de esa tarea y queda fuera de su alcance.
export async function getStockedProductsForBranch(
  branchId: Branch['id'],
  signal?: AbortSignal
): Promise<StockedInventoryItem[]> {
  return httpClient.request<StockedInventoryItem[]>({
    method: 'GET',
    path: `/products/stock-by-branch/${branchId}`,
    signal,
    mock: () => {
      // find() dentro de un map() es O(productos x stock): con 50.000
      // productos escanea stockStore entero por cada uno. Se arma un Map
      // indexado por productId (solo del stock de esta sucursal) una sola
      // vez, y la union pasa a ser una lookup O(1) por producto — O(n+m)
      // en vez de O(n*m). No cambia el resultado: sigue siendo left join
      // (falta de registro = stock/minStock en 0, E5).
      const stockByProductId = new Map(
        stockStore.filter((s) => s.branchId === branchId).map((s) => [s.productId, s])
      );
      return productsStore.map((product) => {
        const record = stockByProductId.get(product.id);
        return structuredClone({
          ...product,
          productId: product.id,
          branchId,
          stock: record?.stock ?? 0,
          minStock: record?.minStock ?? 0,
        });
      });
    },
  });
}

// ============================================================
// BAJO STOCK MINIMO — PAGINADO SERVER-SIDE (P1, DECISIONES_TECNICAS.md)
// Reemplaza a la antigua getLowStockForBranch (devolvia el array
// completo). El servicio filtra, ordena, cuenta y corta el (mismo
// patron que deliveries.service.ts#getDeliveriesPage).
// ============================================================

export interface LowStockQueryFilters {
  branchId: Branch['id'];
}

export type LowStockSortField = 'sku' | 'name' | 'stock' | 'minStock';

function compareLowStock(a: StockedInventoryItem, b: StockedInventoryItem, field: LowStockSortField): number {
  switch (field) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'stock':
      return a.stock - b.stock;
    case 'minStock':
      return a.minStock - b.minStock;
    case 'sku':
    default:
      return a.sku.localeCompare(b.sku);
  }
}

// Productos bajo stock minimo (E6: stock <= minStock, ya no < estricto)
// en una sucursal. Igual que la version anterior, NO completa con ceros
// los productos sin registro de stock en la sucursal (E5): un producto
// no dado de alta ahi no tiene minimo definido, asi que no puede estar
// "bajo minimo" — se excluye en vez de aparecer con minStock 0.
// Compartido entre getLowStockPage y exportLowStock (no se duplica la
// logica de filtrado/orden entre paginado y export). Sin dateFrom/
// dateTo a proposito (tarea transversal, DECISIONES_TECNICAS.md):
// StockedInventoryItem no tiene ningun campo de fecha — es una foto del
// stock actual, no un registro con fecha propia — asi que este listado
// queda afuera del selector de rango de fecha.
function filterAndSortLowStock(
  filters: LowStockQueryFilters,
  sort: { field: LowStockSortField; direction: 'asc' | 'desc' } | undefined
): StockedInventoryItem[] {
  const productById = new Map(productsStore.map((p) => [p.id, p]));

  const matches: StockedInventoryItem[] = [];
  for (const record of stockStore) {
    if (record.branchId !== filters.branchId || record.stock > record.minStock) continue;
    const product = productById.get(record.productId);
    if (product) matches.push({ ...product, ...record });
  }

  const sortField = sort?.field ?? 'sku';
  const direction = sort?.direction ?? 'asc';
  return matches.sort((a, b) => {
    const cmp = compareLowStock(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.4): un orden ambiguo hace que el
    // mismo producto aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

// Productos bajo stock minimo (E6: stock <= minStock, ya no < estricto)
// en una sucursal. Igual que la version anterior, NO completa con ceros
// los productos sin registro de stock en la sucursal (E5): un producto
// no dado de alta ahi no tiene minimo definido, asi que no puede estar
// "bajo minimo" — se excluye en vez de aparecer con minStock 0.
export async function getLowStockPage(
  query: PageQuery<LowStockQueryFilters, LowStockSortField>,
  signal?: AbortSignal
): Promise<PageResult<StockedInventoryItem>> {
  return httpClient.request<PageResult<StockedInventoryItem>>({
    method: 'GET',
    path: '/products/low-stock',
    params: {
      branchId: query.filters.branchId,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { filters, sort, page, pageSize } = query;
      const sorted = filterAndSortLowStock(filters, sort);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return { items: structuredClone(items), total, page: safePage, pageSize };
    },
  });
}

// Exportar (tarea transversal, DECISIONES_TECNICAS.md): TODO lo que
// matchea filtros, sin paginar, hasta MAX_EXPORT_ROWS.
export async function exportLowStock(
  filters: LowStockQueryFilters,
  sort?: { field: LowStockSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<StockedInventoryItem>> {
  return httpClient.request<ExportResult<StockedInventoryItem>>({
    method: 'GET',
    path: '/products/low-stock/export',
    params: { branchId: filters.branchId },
    mock: () => {
      const sorted = filterAndSortLowStock(filters, sort);
      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS);

      return { items: structuredClone(items), truncated };
    },
  });
}
