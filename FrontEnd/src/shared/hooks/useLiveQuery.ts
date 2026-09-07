import { usePagedQuery, type UsePagedQueryOptions, type UsePagedQueryResult } from './usePagedQuery';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';

// ============================================================
// useLiveQuery — ADR-003 (Tanda 8, corrida completa): "tiempo real"
// es polling detras de un hook dedicado, no WebSocket/SSE — el dia
// que se decida cambiar el transporte, se reescribe ESTE archivo, y
// ningun componente que lo consuma (ej. LogisticsPage) cambia una
// linea. Envuelve `usePagedQuery` (no lo reemplaza): misma firma,
// mismo contrato de paginacion server-side — el polling vuelve a
// pedir la MISMA pagina paginada con los MISMOS filtros vigentes,
// nunca la lista completa (ver ADR-003, "Alternativas descartadas").
// ============================================================

export function useLiveQuery<TItem, TFilters, TSort extends string = string, TAggregates = undefined>(
  fetchPage: (query: PageQuery<TFilters, TSort>, signal: AbortSignal) => Promise<PageResult<TItem, TAggregates>>,
  filters: TFilters,
  options: Omit<UsePagedQueryOptions<TSort>, 'live'> = {}
): UsePagedQueryResult<TItem, TSort, TAggregates> {
  return usePagedQuery(fetchPage, filters, { ...options, live: true });
}
