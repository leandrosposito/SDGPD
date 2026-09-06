import type { ProductHistoryEvent } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import { httpClient } from '@/shared/api/httpClient';
import type { ProductHistoryEventDTO, ProductHistoryPageDTO } from './dto';
import { productHistoryEventFromDTO, productHistoryEventToDTO } from './mapper';

// ============================================================
// product-history.service — Auditoría de eventos de producto (cambios
// de precio, actualizaciones de proveedor, ingresos/egresos), Tanda 3g
// de escalabilidad.
//
// UBICACIÓN (ver DECISIONES_TECNICAS.md, entrada de Tanda 3g): vive en
// `modules/inventory/api/product-history/`, NO en `shared/api/` — este
// dominio es EXCLUSIVO de `inventory` (confirmado por grep).
//
// CON BÚSQUEDA (a diferencia de `movements`): `TabProductHistory.tsx`
// ya tenía un buscador local, en memoria, por SKU/nombre — Paso 1 del
// reconocimiento de esta tanda. Se migra server-side, debounced.
//
// Store en espacio DTO, mismo criterio que el resto de las tandas sin
// lógica intocable que lea el dominio directo.
// ============================================================

// `const`, no `let`: sin mutadores todavía (ningún flujo de la app
// genera un evento de historial nuevo hoy — ver DECISIONES_TECNICAS.md,
// evaluación de invalidación cruzada de esta tanda).
const productHistoryDTOStore: ProductHistoryEventDTO[] = INVENTORY_MOCK_DATA.history.map(productHistoryEventToDTO);

export interface ProductHistoryQueryFilters {
  empresaId: string;
  branchId: Branch['id'];
  search?: string;
}

export type ProductHistorySortField = 'date' | 'productName';

function matchesSearch(event: ProductHistoryEventDTO, search: string | undefined): boolean {
  if (!search) return true;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return event.sku.toLowerCase().includes(q) || event.nombre_producto.toLowerCase().includes(q);
}

function compareProductHistory(
  a: ProductHistoryEventDTO,
  b: ProductHistoryEventDTO,
  field: ProductHistorySortField
): number {
  switch (field) {
    case 'productName':
      return a.nombre_producto.localeCompare(b.nombre_producto);
    case 'date':
    default:
      return a.fecha.localeCompare(b.fecha);
  }
}

function filterAndSortProductHistory(
  filters: ProductHistoryQueryFilters,
  sort: { field: ProductHistorySortField; direction: 'asc' | 'desc' } | undefined
): ProductHistoryEventDTO[] {
  const inScope = productHistoryDTOStore.filter(
    (e) => e.sucursal_id === filters.branchId && matchesSearch(e, filters.search)
  );

  // Default mas reciente primero (mismo criterio que
  // movements.service#filterAndSortMovements).
  const sortField = sort?.field ?? 'date';
  const direction = sort?.direction ?? 'desc';
  return [...inScope].sort((a, b) => {
    const cmp = compareProductHistory(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

// fetchPage de usePagedQuery — firma exacta (query, signal?).
export async function getProductHistoryPage(
  query: PageQuery<ProductHistoryQueryFilters, ProductHistorySortField>,
  signal?: AbortSignal
): Promise<PageResult<ProductHistoryEvent>> {
  const pageDTO = await httpClient.request<ProductHistoryPageDTO>({
    method: 'GET',
    path: '/inventory/product-history',
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
      const sorted = filterAndSortProductHistory(query.filters, query.sort);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const safePage = Math.min(Math.max(1, query.page), totalPages);
      const start = (safePage - 1) * query.pageSize;

      return {
        data: sorted.slice(start, start + query.pageSize),
        meta: { total, page: safePage, page_size: query.pageSize },
      };
    },
  });

  return {
    items: pageDTO.data.map(productHistoryEventFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}
