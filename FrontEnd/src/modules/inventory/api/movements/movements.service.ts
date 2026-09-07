import type { InventoryMovement } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import { httpClient } from '@/shared/api/httpClient';
import type { InventoryMovementDTO, InventoryMovementsPageDTO } from './dto';
import { inventoryMovementFromDTO, inventoryMovementToDTO } from './mapper';

// ============================================================
// movements.service — Movimientos de stock (ingresos/egresos/ajustes),
// Tanda 3g de escalabilidad.
//
// UBICACIÓN (ver DECISIONES_TECNICAS.md, entrada de Tanda 3g): vive en
// `modules/inventory/api/movements/`, NO en `shared/api/` — a
// diferencia de `products` (Tanda 3e), este dominio es EXCLUSIVO de
// `inventory`. Confirmado por grep (`InventoryMovement` solo aparece en
// `inventory.types.ts` y `TabMovements.tsx` antes de esta tanda).
//
// SIN BÚSQUEDA a propósito: `TabMovements.tsx` nunca tuvo un buscador
// (a diferencia de Historial) — no se le inventa uno que no fue pedido.
//
// Store en espacio DTO (mismo criterio que `products`/`suppliers`/
// `orders`/`cash`): no hay ninguna lógica intocable que lea el dominio
// directo sin pasar por un mapper.
// ============================================================

// `const`, no `let`: no hay ningun mutador todavia (alta/ajuste de
// stock que generara un movimiento real queda fuera de alcance de esta
// tanda, mismo criterio que `stockDTOStore` en products.service.ts).
const movementsDTOStore: InventoryMovementDTO[] = INVENTORY_MOCK_DATA.movements.map(inventoryMovementToDTO);

export interface MovementsQueryFilters {
  empresaId: string;
  branchId: Branch['id'];
}

export type MovementsSortField = 'date' | 'productName' | 'quantity';

function compareMovements(a: InventoryMovementDTO, b: InventoryMovementDTO, field: MovementsSortField): number {
  switch (field) {
    case 'productName':
      return a.nombre_producto.localeCompare(b.nombre_producto);
    case 'quantity':
      return a.cantidad - b.cantidad;
    case 'date':
    default:
      return a.fecha.localeCompare(b.fecha);
  }
}

function filterAndSortMovements(
  filters: MovementsQueryFilters,
  sort: { field: MovementsSortField; direction: 'asc' | 'desc' } | undefined
): InventoryMovementDTO[] {
  const inScope = movementsDTOStore.filter((m) => m.sucursal_id === filters.branchId);

  // Default mas reciente primero (mismo criterio que
  // purchaseOrders.service#sortOrders, createdAt:desc): un log de
  // movimientos se lee de lo mas nuevo a lo mas viejo por convencion,
  // el mock antes de esta tanda no tenia ningun orden definido.
  const sortField = sort?.field ?? 'date';
  const direction = sort?.direction ?? 'desc';
  return [...inScope].sort((a, b) => {
    const cmp = compareMovements(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id: un orden ambiguo hace que el mismo
    // movimiento aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

// fetchPage de usePagedQuery — firma exacta (query, signal?).
export async function getMovementsPage(
  query: PageQuery<MovementsQueryFilters, MovementsSortField>,
  signal?: AbortSignal
): Promise<PageResult<InventoryMovement>> {
  const pageDTO = await httpClient.request<InventoryMovementsPageDTO>({
    method: 'GET',
    path: '/inventory/movements',
    params: {
      empresaId: query.filters.empresaId,
      branchId: query.filters.branchId,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const sorted = filterAndSortMovements(query.filters, query.sort);

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
    items: pageDTO.data.map(inventoryMovementFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}

// Exportar (mismo patron que exportClientAccounts/exportSuppliers/etc.):
// reusa filterAndSortMovements, no duplica el filtro+orden.
export async function exportMovements(
  filters: MovementsQueryFilters,
  sort?: { field: MovementsSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<InventoryMovement>> {
  return httpClient.request<ExportResult<InventoryMovement>>({
    method: 'GET',
    path: '/inventory/movements/export',
    params: { empresaId: filters.empresaId, branchId: filters.branchId },
    mock: () => {
      const sorted = filterAndSortMovements(filters, sort).map(inventoryMovementFromDTO);
      const truncated = sorted.length > MAX_EXPORT_ROWS;
      const items = sorted.slice(0, MAX_EXPORT_ROWS);
      return { items: structuredClone(items), truncated };
    },
  });
}
