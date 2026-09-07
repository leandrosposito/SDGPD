import type { PurchaseSuggestionDTO } from './dto';

// ============================================================
// filterSort.ts (purchase-suggestions) — lógica PURA de filtro/orden/
// paginado, sin ningún import de httpClient (que lee `import.meta.env`
// a nivel de módulo, inexistente fuera de Vite). Separado para que el
// smoke script (`scripts/smoke/tanda-3f.smoke.mjs`) pueda ejercitarla
// con `node` puro sin arrastrar esa cadena de imports — mismo criterio
// ya usado en `dashboardAggregates.ts`/`alertsCursor.ts` (Tanda 7) y
// `useUrlListState.ts` (Tanda 4). `purchase-suggestions.service.ts` es
// la capa async/httpClient que llama a estas funciones sobre datos
// reales.
// ============================================================

export interface PurchaseSuggestionsFilters {
  empresaId: string;
  branchId: string;
}

export type PurchaseSuggestionsSortField = 'productName' | 'currentStock' | 'suggestedQuantity' | 'estimatedCost';

export interface PurchaseSuggestionsSort {
  field: PurchaseSuggestionsSortField;
  direction: 'asc' | 'desc';
}

function compareSuggestions(a: PurchaseSuggestionDTO, b: PurchaseSuggestionDTO, field: PurchaseSuggestionsSortField): number {
  switch (field) {
    case 'currentStock':
      return a.stock_actual - b.stock_actual;
    case 'suggestedQuantity':
      return a.cantidad_sugerida - b.cantidad_sugerida;
    case 'estimatedCost':
      return a.costo_estimado - b.costo_estimado;
    case 'productName':
    default:
      return a.nombre_producto.localeCompare(b.nombre_producto);
  }
}

// Solo la sucursal pedida — mismo criterio que
// movements.service.ts#filterAndSortMovements: `PurchaseSuggestion` es
// alcance SUCURSAL (E1), la comparación es por `branchId` exacto, no
// por rango ni texto libre.
export function filterAndSortPurchaseSuggestions(
  suggestions: readonly PurchaseSuggestionDTO[],
  filters: PurchaseSuggestionsFilters,
  sort: PurchaseSuggestionsSort | undefined
): PurchaseSuggestionDTO[] {
  const inScope = suggestions.filter((s) => s.sucursal_id === filters.branchId);

  // Default: mayor déficit de stock primero (menor `stock_actual`
  // respecto de `stock_minimo` es lo más urgente de reponer) — como no
  // hay un campo "déficit" en el DTO, se aproxima ordenando por
  // `currentStock` ascendente (lo que menos stock tiene aparece
  // primero), que es el criterio que ya usaba la tabla implícitamente
  // al no tener orden (el mock listaba todo junto, sin prioridad).
  const sortField = sort?.field ?? 'currentStock';
  const direction = sort?.direction ?? 'asc';

  return [...inScope].sort((a, b) => {
    const cmp = compareSuggestions(a, b, sortField);
    const primary = direction === 'asc' ? cmp : -cmp;
    // Desempate estable por id: un orden ambiguo hace que la misma
    // sugerencia aparezca en dos páginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });
}

export function paginateSuggestions(
  sorted: readonly PurchaseSuggestionDTO[],
  page: number,
  pageSize: number
): { items: PurchaseSuggestionDTO[]; total: number; page: number; pageSize: number } {
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
  };
}
