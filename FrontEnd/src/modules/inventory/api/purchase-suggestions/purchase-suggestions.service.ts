import type { PurchaseSuggestion } from '@/shared/types/inventory.types';
import type { Branch } from '@/shared/types/session.types';
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types';
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types';
import { INVENTORY_MOCK_DATA } from '@/data/mock/inventory.data';
import { httpClient } from '@/shared/api/httpClient';
import type { PurchaseSuggestionDTO, PurchaseSuggestionsPageDTO } from './dto';
import { purchaseSuggestionFromDTO, purchaseSuggestionToDTO } from './mapper';
import { filterAndSortPurchaseSuggestions, paginateSuggestions, type PurchaseSuggestionsSortField } from './filterSort';

// ============================================================
// purchase-suggestions.service — Sugerencias de reposición (Tanda 3f
// de escalabilidad, cierra la última tanda pendiente de la Fase A
// original). Mismo criterio de ubicación/forma que `movements.service.ts`
// (Tanda 3g): dominio EXCLUSIVO de `inventory`, store en espacio DTO,
// pasa por `httpClient` (Tanda 2.5).
//
// Único listado de datos reales que quedaba sin paginar server-side —
// ver AUDIT_2026-09-07_conexion-export-3fg.md, Tarea 4.
// ============================================================

// `const`, no `let`: sin mutador todavía (la única mutación real de
// este dominio, "generar OC", vive en purchaseOrders.service.ts y no
// toca este store — mismo criterio que `movementsDTOStore`).
const suggestionsDTOStore: PurchaseSuggestionDTO[] = INVENTORY_MOCK_DATA.suggestions.map(purchaseSuggestionToDTO);

export type { PurchaseSuggestionsSortField };

export interface PurchaseSuggestionsQueryFilters {
  empresaId: string;
  branchId: Branch['id'];
}

// fetchPage de usePagedQuery — firma exacta (query, signal?).
export async function getPurchaseSuggestionsPage(
  query: PageQuery<PurchaseSuggestionsQueryFilters, PurchaseSuggestionsSortField>,
  signal?: AbortSignal
): Promise<PageResult<PurchaseSuggestion>> {
  const pageDTO = await httpClient.request<PurchaseSuggestionsPageDTO>({
    method: 'GET',
    path: '/inventory/purchase-suggestions',
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
      const sorted = filterAndSortPurchaseSuggestions(suggestionsDTOStore, query.filters, query.sort);
      const { items, total, page, pageSize } = paginateSuggestions(sorted, query.page, query.pageSize);
      return { data: items, meta: { total, page, page_size: pageSize } };
    },
  });

  return {
    items: pageDTO.data.map(purchaseSuggestionFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  };
}

// Exportar (Tanda C de esta sesion, ADR-004): TODO lo que matchea
// branchId+empresaId, sin paginar, hasta MAX_EXPORT_ROWS. Reusa
// filterAndSortPurchaseSuggestions (misma logica que getPurchaseSuggestionsPage,
// no duplicada).
export async function exportPurchaseSuggestions(
  filters: PurchaseSuggestionsQueryFilters,
  sort?: { field: PurchaseSuggestionsSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<PurchaseSuggestion>> {
  return httpClient
    .request<ExportResult<PurchaseSuggestionDTO>>({
      method: 'GET',
      path: '/inventory/purchase-suggestions/export',
      params: { empresaId: filters.empresaId, branchId: filters.branchId },
      mock: () => {
        const sorted = filterAndSortPurchaseSuggestions(suggestionsDTOStore, filters, sort);
        const truncated = sorted.length > MAX_EXPORT_ROWS;
        const items = sorted.slice(0, MAX_EXPORT_ROWS);
        return { items: structuredClone(items), truncated };
      },
    })
    .then((result) => ({ items: result.items.map(purchaseSuggestionFromDTO), truncated: result.truncated }));
}
