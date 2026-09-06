import type { InventoryItem, ProductStock, StockedInventoryItem } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import { PRODUCT_STOCK_MOCK_DATA } from '@/data/mock/productStock.data';
import { httpClient } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/ApiError';
import type {
  ProductDTO,
  ProductStockDTO,
  StockedProductDTO,
  StockedProductsPageDTO,
  StockAggregatesDTO,
  LowStockPageDTO,
} from './dto';
import {
  productFromDTO,
  productToDTO,
  productStockFromDTO,
  productStockToDTO,
  stockedProductFromDTO,
  productFormInputToDTO,
  type ProductFormInput,
} from './mapper';

export type { ProductFormInput };

// ============================================================
// products.service — RF-PRD-001 (ABM Central de Productos) + stock por
// sucursal (E1/E4). Tanda 3e de escalabilidad.
//
// UBICACIÓN (decisión central de esta tanda, ver
// docs/DECISIONES_TECNICAS.md, "Productos es un dominio transversal"):
// este archivo vive en `shared/api/products/`, NO en
// `modules/inventory/api/`. Productos ya tenía consumidores reales
// fuera de `inventory` antes de esta tanda (`ComprasPage.tsx`,
// `CreateOrderModal.tsx`, `OrderProductsSection.tsx` — ver
// docs/RELEVAMIENTO_INVENTORY.md, D3) — moverlo a `modules/inventory/api/`
// habría fijado un acoplamiento cross-módulo nuevo, justo lo que R2
// viene evitando en cada tanda anterior. `shared/api/` preserva la
// neutralidad que ya tenía `src/services/mock/products.service.ts`
// (fuera de toda carpeta de módulo) y le suma la disciplina de capa
// (dto/mapper/service) del resto de las tandas migradas.
//
// ABSORCIÓN COMPLETA: este archivo reemplaza a
// `src/services/mock/products.service.ts` (borrado en esta tanda) con
// TODAS sus funciones — no hay ningún estado compartido por referencia
// entre ellas que lo exigiera (a diferencia de `clientsStore` en Tanda
// 3d, ver RELEVAMIENTO_INVENTORY.md D1): acá es una decisión de
// prolijidad (un solo archivo para todo el dominio "productos"), no una
// necesidad técnica.
//
// STORE EN ESPACIO DTO (a diferencia de `clients`, Tanda 3d, que lo
// dejó en dominio): acá no hay ninguna lógica intocable que lea el
// dominio directo sin pasar por un mapper, así que el store puede vivir
// en la forma que ya usan `suppliers`/`orders`/`cash` — reasignado
// (nunca mutado in-place) en cada escritura.
//
// LÓGICA PRESERVADA SIN CAMBIOS DE COMPORTAMIENTO (D4,
// RELEVAMIENTO_INVENTORY.md) — el ALGORITMO es el mismo que en
// `services/mock/products.service.ts`, aunque el texto cambió porque
// ahora opera sobre nombres de campo DTO (snake_case) en vez de
// dominio: el join por `Map` O(n+m) (antes en
// `getStockedProductsForBranch`, ahora en `joinProductWithStock` +
// `filterAndSortStockedProducts`), la regla E5 (producto sin stock en
// la sucursal = 0, no se excluye, salvo en Bajo Stock Mínimo donde SÍ
// se excluye), la regla E6 (bajo mínimo es `stock <= minStock`, no `<`
// estricto), el desempate estable por `id` al ordenar, y las
// validaciones de unicidad de SKU/código de barras.
// ============================================================

// ------------------------------------------------------------
// "Servidor" mock — espacio DTO, sembrado una sola vez desde
// data/mock/inventory.data.ts / productStock.data.ts (dominio) vía
// productToDTO/productStockToDTO.
// ------------------------------------------------------------
let productsDTOStore: ProductDTO[] = INVENTORY_MOCK_DATA.items.map(productToDTO);

// Stock por sucursal (E4): entidad separada del catálogo, sin
// mutadores todavía (movimientos/ajustes de stock quedan fuera de
// alcance de esta tanda, ver RELEVAMIENTO_INVENTORY.md) — `const`,
// nunca reasignada, igual que en el archivo que reemplaza.
const stockDTOStore: ProductStockDTO[] = PRODUCT_STOCK_MOCK_DATA.map(productStockToDTO);

export async function fetchProducts(empresaId: string, signal?: AbortSignal): Promise<InventoryItem[]> {
  return httpClient.request<InventoryItem[]>({
    method: 'GET',
    path: '/products',
    params: { empresaId },
    signal,
    mock: () => productsDTOStore.map(productFromDTO),
  });
}

export async function createProduct(empresaId: string, input: ProductFormInput): Promise<InventoryItem> {
  return httpClient.request<InventoryItem>({
    method: 'POST',
    path: '/products',
    body: { empresaId, ...productFormInputToDTO(input) },
    mock: () => {
      const skuTaken = productsDTOStore.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase());
      if (skuTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este SKU ya existe.');

      const barcodeTaken = productsDTOStore.some((p) => p.codigo_barras === input.barcode);
      if (barcodeTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este codigo de barras ya existe.');

      const newDTO: ProductDTO = { ...productFormInputToDTO(input), id: `inv-${Date.now()}`, lotes: [] };
      productsDTOStore = [...productsDTOStore, newDTO];
      return productFromDTO(newDTO);
    },
  });
}

export async function updateProduct(empresaId: string, id: string, input: ProductFormInput): Promise<InventoryItem> {
  return httpClient.request<InventoryItem>({
    method: 'PUT',
    path: `/products/${id}`,
    body: { empresaId, ...productFormInputToDTO(input) },
    mock: () => {
      const exists = productsDTOStore.some((p) => p.id === id);
      if (!exists) throw new ApiError(404, 'CLIENT_ERROR', 'El producto que intenta editar ya no existe.');

      const skuTaken = productsDTOStore.some(
        (p) => p.sku.toLowerCase() === input.sku.toLowerCase() && p.id !== id
      );
      if (skuTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este SKU ya existe.');

      const barcodeTaken = productsDTOStore.some((p) => p.codigo_barras === input.barcode && p.id !== id);
      if (barcodeTaken) throw new ApiError(400, 'CLIENT_ERROR', 'Este codigo de barras ya existe.');

      // NOTA (hallazgo de esta tanda, no una regresión nueva):
      // `ProductFormInput` no incluye `lots` (el formulario de
      // producto nunca los edita) — igual que en
      // `services/mock/products.service.ts#updateProduct` antes de
      // esta tanda, el registro actualizado no copia los lotes del
      // anterior. El comportamiento visible es idéntico al que ya
      // existía (editar un producto deja sus lotes vacíos); no se
      // corrige acá porque no fue pedido y es lógica de negocio, no de
      // paginación/cache — queda para PENDIENTES.md.
      const updatedDTO: ProductDTO = { ...productFormInputToDTO(input), id, lotes: [] };
      productsDTOStore = productsDTOStore.map((p) => (p.id === id ? updatedDTO : p));
      return productFromDTO(updatedDTO);
    },
  });
}

export async function deleteProduct(empresaId: string, id: string): Promise<void> {
  return httpClient.request<void>({
    method: 'DELETE',
    path: `/products/${id}`,
    params: { empresaId },
    mock: () => {
      const exists = productsDTOStore.some((p) => p.id === id);
      if (!exists) throw new ApiError(404, 'CLIENT_ERROR', 'El producto que intenta eliminar ya no existe.');

      productsDTOStore = productsDTOStore.filter((p) => p.id !== id);
    },
  });
}

// ============================================================
// STOCK POR SUCURSAL (E4) — ningún componente debe recorrer
// stockDTOStore a mano; todo acceso pasa por estas funciones, que
// reciben branchId como parámetro explícito (nunca leen
// useSessionStore acá, mismo criterio que deliveries.service.ts#D4).
// ============================================================

// Lectura puntual del registro de stock de un producto en una sucursal.
// undefined si el producto no está dado de alta en esa sucursal (E5):
// no es un error, es un estado válido.
export async function getStockForBranch(
  empresaId: string,
  productId: InventoryItem['id'],
  branchId: Branch['id'],
  signal?: AbortSignal
): Promise<ProductStock | undefined> {
  return httpClient.request<ProductStock | undefined>({
    method: 'GET',
    path: `/products/${productId}/stock/${branchId}`,
    params: { empresaId },
    signal,
    mock: () => {
      const record = stockDTOStore.find((s) => s.producto_id === productId && s.sucursal_id === branchId);
      return record ? productStockFromDTO(record) : undefined;
    },
  });
}

// E6: "bajo stock mínimo" es stock <= minStock, no < estricto. ÚNICO
// lugar donde se evalúa esta regla — reusada por getLowStockPage
// (listado de bajo stock) y computeStockAggregates (KPI "Stock Bajo"
// de Stock Actual): las dos pantallas no pueden mostrar un número
// distinto para el mismo dato (instrucción explícita de esta tanda).
function isBelowMinStock(stock: number, minStock: number): boolean {
  return stock <= minStock;
}

// Une un producto con su registro de stock en una sucursal (E5: sin
// registro = stock/minStock en 0, no se excluye) — mismo criterio que
// getStockedProductsForBranch antes de esta tanda.
function joinProductWithStock(
  product: ProductDTO,
  record: ProductStockDTO | undefined,
  branchId: Branch['id']
): StockedProductDTO {
  return {
    ...product,
    producto_id: product.id,
    sucursal_id: branchId,
    stock: record?.stock ?? 0,
    stock_minimo: record?.stock_minimo ?? 0,
  };
}

export type StockedProductSortField = 'sku' | 'name' | 'stock' | 'minStock';

function compareStockedProducts(a: StockedProductDTO, b: StockedProductDTO, field: StockedProductSortField): number {
  switch (field) {
    case 'name':
      return a.nombre.localeCompare(b.nombre);
    case 'stock':
      return a.stock - b.stock;
    case 'minStock':
      return a.stock_minimo - b.stock_minimo;
    case 'sku':
    default:
      return a.sku.localeCompare(b.sku);
  }
}

// ============================================================
// STOCK ACTUAL — PAGINADO SERVER-SIDE (Tanda 3e). Reemplaza a
// getStockedProductsForBranch (eliminada en esta tanda, ver nota más
// abajo). El servicio filtra (búsqueda), une con stock (E5), calcula
// agregados sobre TODO lo filtrado y recién ahí pagina — mismo patrón
// que orders/cash/clients.
// ============================================================

export interface StockedProductsQueryFilters {
  empresaId: string;
  branchId: Branch['id'];
  search?: string;
}

// Agregados (P3): reemplazan el cálculo que hacía TabStockCurrent.tsx
// en memoria sobre el array completo (totalProducts/lowStock/
// outOfStock/totalValue) — se calculan sobre TODO lo que matchea la
// búsqueda vigente en la sucursal, nunca sobre `items` de la página.
export interface StockAggregates {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

function matchesSearch(product: ProductDTO, search: string | undefined): boolean {
  if (!search) return true;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    product.sku.toLowerCase().includes(q) ||
    product.codigo_barras.toLowerCase().includes(q) ||
    product.nombre.toLowerCase().includes(q) ||
    (product.descripcion?.toLowerCase().includes(q) ?? false)
  );
}

// Compartida entre getStockedProductsPage y computeStockAggregates (no
// se duplica la lógica de filtro+join): arma el Map de stock UNA vez
// (mismo criterio O(n+m) que el archivo que reemplaza), filtra por
// búsqueda y une cada producto con su stock en la sucursal (E5, left
// join — a diferencia de Bajo Stock Mínimo, acá NO se excluye nada).
//
// Devuelve tambien `stockByProductId` (no solo `joined`): computeStockAggregates
// lo necesita para saber, por producto, si existe un registro REAL de
// stock en la sucursal — dato que se pierde en `joined` (ahi un producto
// sin registro y uno con stock 0 registrado son indistinguibles, los dos
// quedan en `stock: 0` por el `?? 0` de joinProductWithStock, E5).
function filterAndSortStockedProducts(
  filters: StockedProductsQueryFilters,
  sort: { field: StockedProductSortField; direction: 'asc' | 'desc' } | undefined
): { sorted: StockedProductDTO[]; stockByProductId: Map<string, ProductStockDTO> } {
  const stockByProductId = new Map(
    stockDTOStore.filter((s) => s.sucursal_id === filters.branchId).map((s) => [s.producto_id, s])
  );

  const joined: StockedProductDTO[] = [];
  for (const product of productsDTOStore) {
    if (!matchesSearch(product, filters.search)) continue;
    joined.push(joinProductWithStock(product, stockByProductId.get(product.id), filters.branchId));
  }

  const sortField = sort?.field ?? 'sku';
  const direction = sort?.direction ?? 'asc';
  const sorted = joined.sort((a, b) => {
    const cmp = compareStockedProducts(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.4): un orden ambiguo hace que el
    // mismo producto aparezca en dos páginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });

  return { sorted, stockByProductId };
}

// "Stock Bajo" y "Sin Stock" responden dos preguntas DISTINTAS sobre el
// mismo producto, no una partición — se solapan a propósito (hallazgo de
// auditoría de Tanda 3e, ver DECISIONES_TECNICAS.md punto 5): antes de
// este fix eran mutuamente excluyentes (`if/else if`), así que un
// producto con stock 0 y mínimo > 0 (ej. inv-018 en branch-001, stock 0/
// mínimo 30) contaba como "sin stock" pero nunca como "bajo stock" —
// mientras que `getLowStockPage`/`filterAndSortLowStock` (Bajo Stock
// Mínimo) SÍ lo contaba, porque usan la misma `isBelowMinStock` sin
// excluir el cero. Resultado: 12 vs 13 en branch-001, para el mismo
// criterio de negocio.
//
// "Stock Bajo" ahora cuenta TODO lo que cumple `isBelowMinStock`
// (incluido stock === 0) — el MISMO universo que `getLowStockPage` — con
// una sola excepción que replica su comportamiento exacto: un producto
// SIN registro de stock en la sucursal (E5, `stockByProductId` no lo
// tiene) nunca cuenta para "Stock Bajo", porque no tiene mínimo definido
// (mismo motivo por el que `filterAndSortLowStock` lo excluye — itera
// `stockDTOStore`, nunca completa con ceros). Sin esta excepción, un
// producto no dado de alta en la sucursal (stock/mínimo en 0 por el
// `?? 0` del join) pasaría la condición `0 <= 0` y aparecería en "Stock
// Bajo" de Stock Actual sin aparecer nunca en Bajo Stock Mínimo — una
// divergencia nueva, en sentido contrario a la que se está corrigiendo.
// "Sin Stock" no cambia: sigue contando cualquier item en `stock === 0`
// (registrado en 0 o sin registro), tal como ya hacía antes de esta
// tanda en el cálculo en memoria del viejo TabStockCurrent.tsx.
function computeStockAggregates(
  joined: StockedProductDTO[],
  stockByProductId: Map<string, ProductStockDTO>
): StockAggregatesDTO {
  let lowStock = 0;
  let outOfStock = 0;
  let totalValue = 0;
  for (const item of joined) {
    if (item.stock === 0) {
      outOfStock += 1;
    }
    if (stockByProductId.has(item.producto_id) && isBelowMinStock(item.stock, item.stock_minimo)) {
      lowStock += 1;
    }
    totalValue += item.stock * item.costo;
  }
  return {
    total_productos: joined.length,
    stock_bajo: lowStock,
    sin_stock: outOfStock,
    valor_inventario: totalValue,
  };
}

// fetchPage de usePagedQuery — firma exacta (query, signal?).
export async function getStockedProductsPage(
  query: PageQuery<StockedProductsQueryFilters, StockedProductSortField>,
  signal?: AbortSignal
): Promise<PageResult<StockedInventoryItem, StockAggregates>> {
  const pageDTO = await httpClient.request<StockedProductsPageDTO>({
    method: 'GET',
    path: `/products/stock-by-branch/${query.filters.branchId}`,
    params: {
      empresaId: query.filters.empresaId,
      branchId: query.filters.branchId,
      search: query.filters.search,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { sorted, stockByProductId } = filterAndSortStockedProducts(query.filters, query.sort);
      // Agregados sobre TODO lo filtrado, antes de paginar (P3).
      const aggregates = computeStockAggregates(sorted, stockByProductId);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const safePage = Math.min(Math.max(1, query.page), totalPages);
      const start = (safePage - 1) * query.pageSize;

      return {
        data: sorted.slice(start, start + query.pageSize),
        meta: { total, page: safePage, page_size: query.pageSize, aggregates },
      };
    },
  });

  return {
    items: pageDTO.data.map(stockedProductFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
    aggregates: {
      totalProducts: pageDTO.meta.aggregates.total_productos,
      lowStock: pageDTO.meta.aggregates.stock_bajo,
      outOfStock: pageDTO.meta.aggregates.sin_stock,
      totalValue: pageDTO.meta.aggregates.valor_inventario,
    },
  };
}

// ============================================================
// BAJO STOCK MÍNIMO — PAGINADO SERVER-SIDE (ya existía antes de esta
// tanda, migrado acá sin cambios de comportamiento). A diferencia de
// getStockedProductsPage (left join, E5), este listado SÍ excluye los
// productos sin registro de stock en la sucursal: un producto no dado
// de alta ahí no tiene mínimo definido, no puede estar "bajo mínimo".
// Compartida entre getLowStockPage y exportLowStock (no se duplica la
// lógica de filtrado/orden entre paginado y export). Sin dateFrom/
// dateTo a propósito: StockedInventoryItem no tiene ningún campo de
// fecha — es una foto del stock actual, no un registro con fecha
// propia.
// ============================================================

// `search` agregado (hallazgo funcional post-Tanda 3e): esta tab no
// tenía búsqueda propia. Reusa `matchesSearch` (arriba, misma función
// que `getStockedProductsPage`) — mismos 4 campos (sku/código de
// barras/nombre/descripción), no se reimplementa el predicado.
export interface LowStockQueryFilters {
  empresaId: string;
  branchId: Branch['id'];
  search?: string;
}

// `deficit` agregado (`stock_minimo - stock`, "cuánto falta para llegar
// al mínimo"): no existe en `StockedProductSortField` (Stock Actual no
// tiene esa columna) — se extiende el tipo en vez de tocar el de Stock
// Actual, para no ofrecerle un orden que no tiene sentido ahí.
export type LowStockSortField = StockedProductSortField | 'deficit';

function compareLowStock(a: StockedProductDTO, b: StockedProductDTO, field: LowStockSortField): number {
  if (field === 'deficit') {
    return (a.stock_minimo - a.stock) - (b.stock_minimo - b.stock);
  }
  return compareStockedProducts(a, b, field);
}

function filterAndSortLowStock(
  filters: LowStockQueryFilters,
  sort: { field: LowStockSortField; direction: 'asc' | 'desc' } | undefined
): StockedProductDTO[] {
  const productById = new Map(productsDTOStore.map((p) => [p.id, p]));

  const matches: StockedProductDTO[] = [];
  for (const record of stockDTOStore) {
    if (record.sucursal_id !== filters.branchId || !isBelowMinStock(record.stock, record.stock_minimo)) continue;
    const product = productById.get(record.producto_id);
    if (!product || !matchesSearch(product, filters.search)) continue;
    matches.push(joinProductWithStock(product, record, filters.branchId));
  }

  const sortField = sort?.field ?? 'sku';
  const direction = sort?.direction ?? 'asc';
  return matches.sort((a, b) => {
    const cmp = compareLowStock(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id (3.4).
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

export async function getLowStockPage(
  query: PageQuery<LowStockQueryFilters, LowStockSortField>,
  signal?: AbortSignal
): Promise<PageResult<StockedInventoryItem>> {
  const pageDTO = await httpClient.request<LowStockPageDTO>({
    method: 'GET',
    path: '/products/low-stock',
    params: {
      empresaId: query.filters.empresaId,
      branchId: query.filters.branchId,
      search: query.filters.search,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { filters, sort, page, pageSize } = query;
      // Agregados sobre TODO lo filtrado (búsqueda incluida), antes de
      // paginar — mismo criterio que getStockedProductsPage (P3): el
      // total tiene que reflejar el resultado filtrado, no el listado
      // completo de bajo stock.
      const sorted = filterAndSortLowStock(filters, sort);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * pageSize;

      return {
        data: sorted.slice(start, start + pageSize),
        meta: { total, page: safePage, page_size: pageSize },
      };
    },
  });

  return {
    items: pageDTO.data.map(stockedProductFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}

// Exportar (tarea transversal): TODO lo que matchea filtros, sin
// paginar, hasta MAX_EXPORT_ROWS.
export async function exportLowStock(
  filters: LowStockQueryFilters,
  sort?: { field: LowStockSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<StockedInventoryItem>> {
  return httpClient.request<ExportResult<StockedInventoryItem>>({
    method: 'GET',
    path: '/products/low-stock/export',
    params: { empresaId: filters.empresaId, branchId: filters.branchId, search: filters.search },
    mock: () => {
      const sorted = filterAndSortLowStock(filters, sort);
      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS).map(stockedProductFromDTO);

      return { items, truncated };
    },
  });
}
