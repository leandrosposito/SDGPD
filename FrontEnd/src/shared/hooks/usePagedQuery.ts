import { useEffect, useState } from 'react';
import type { PageQuery, PageResult, PageSort } from '@/shared/types/pagination.types';

// ============================================================
// usePagedQuery — Maneja el estado de una consulta paginada contra un
// origen de datos server-side (P4, DECISIONES_TECNICAS.md): pagina,
// tamaño de pagina, filtros y orden, y dispara el fetch. Reemplaza a
// usePagination (eliminado): ese hook cortaba un array ya en memoria;
// este pide la pagina al origen de datos y no conoce el array completo
// en ningun momento. Nombre distinto a proposito — "usePagination"
// hoy seria un nombre que miente sobre lo que hace.
//
// Generico y sin conocimiento de dominio: recibe `fetchPage`, la
// funcion que efectivamente pide la pagina (ej. getDeliveriesPage,
// getLowStockPage), y los `filters` tipados por el consumidor.
//
// IMPORTANTE para quien lo use: `fetchPage` debe ser una referencia
// estable (una funcion exportada de un servicio, no un arrow function
// nuevo en cada render) — esta en las dependencias del efecto que
// dispara el fetch, y una referencia que cambia en cada render
// dispararia un fetch en loop.
// ============================================================

export const DEFAULT_PAGE_SIZE = 25;

export interface UsePagedQueryOptions<TSort extends string> {
  pageSize?: number;
  sort?: PageSort<TSort>;
  // Permite diferir el primer fetch (ej. todavia no hay sucursal activa
  // porque la sesion esta cargando). Default true.
  enabled?: boolean;
}

export interface UsePagedQueryResult<TItem, TSort extends string, TAggregates> {
  items: TItem[];
  aggregates: TAggregates | undefined;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sort: PageSort<TSort> | undefined;
  // true solo hasta que llega la primera respuesta (exito o error) de
  // esta consulta — todavia no hay nada que mostrar.
  isLoading: boolean;
  // true mientras hay un pedido en vuelo, incluidos los disparados por
  // cambio de pagina/tamaño/orden/refetch (P5). `items` NO se vacia
  // mientras esto es true: quien consume el hook decide como mostrarlo
  // (ver shared/components/ui/FetchingOverlay).
  isFetching: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: PageSort<TSort> | undefined) => void;
  // Vuelve a pedir la consulta actual sin cambiar pagina/filtros/orden
  // (P10: reflejar una mutacion del servidor pidiendo de nuevo la
  // pagina vigente, en vez de actualizar `items` a mano en el cliente).
  refetch: () => void;
}

export function usePagedQuery<TItem, TFilters, TSort extends string = string, TAggregates = undefined>(
  fetchPage: (query: PageQuery<TFilters, TSort>) => Promise<PageResult<TItem, TAggregates>>,
  filters: TFilters,
  options: UsePagedQueryOptions<TSort> = {}
): UsePagedQueryResult<TItem, TSort, TAggregates> {
  const { pageSize: initialPageSize = DEFAULT_PAGE_SIZE, sort: initialSort, enabled = true } = options;

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sort, setSortState] = useState<PageSort<TSort> | undefined>(initialSort);
  const [refetchToken, setRefetchToken] = useState(0);

  const [items, setItems] = useState<TItem[]>([]);
  const [aggregates, setAggregates] = useState<TAggregates | undefined>(undefined);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vuelve a pagina 1 cuando cambian los filtros (P9: branchId viaja
  // ahi, asi que un cambio de sucursal entra por esta misma via) —
  // comparacion por referencia durante el render, mismo patron que ya
  // usaba el usePagination anterior con su `resetKey` (evita un efecto
  // extra solo para "resetear pagina"). El llamador debe memoizar
  // `filters` (useMemo) para que la referencia solo cambie cuando de
  // verdad cambia algun valor.
  const [trackedFilters, setTrackedFilters] = useState(filters);
  if (filters !== trackedFilters) {
    setTrackedFilters(filters);
    setPageState(1);
    setIsFetching(true);
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchPage({ page, pageSize, filters: trackedFilters, sort })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setAggregates(result.aggregates);
        setTotalItems(result.total);
        setError(null);
        // La pagina devuelta puede diferir de la pedida si quedo fuera
        // de rango (ver PageResult#page) — nos alineamos a la real.
        if (result.page !== page) setPageState(result.page);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar la lista.');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
        setIsFetching(false);
      });
    // Descarta respuestas fuera de orden (P5): si cambia algo antes de
    // que este pedido resuelva, el cleanup marca `cancelled` y el
    // resultado tardio no pisa al de un pedido mas nuevo — mismo patron
    // ya usado en el resto del proyecto (InventoryPage, etc.).
    return () => {
      cancelled = true;
    };
  }, [fetchPage, trackedFilters, sort, page, pageSize, enabled, refetchToken]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // setPage/setPageSize/setSort/refetch corren en manejadores de
  // eventos (clicks, no efectos): marcar isFetching=true aca es
  // sincronico pero no dispara la regla react-hooks/set-state-in-effect
  // (esa regla aplica al cuerpo de un efecto, no a un handler). Se
  // guarda contra llamadas que no cambian nada para no dejar
  // isFetching en true sin que el efecto vuelva a correr.
  function setPage(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === page) return;
    setPageState(clamped);
    setIsFetching(true);
  }

  function setPageSize(size: number) {
    if (size === pageSize && page === 1) return;
    setPageSizeState(size);
    setPageState(1);
    setIsFetching(true);
  }

  function setSort(next: PageSort<TSort> | undefined) {
    const same = next?.field === sort?.field && next?.direction === sort?.direction;
    if (same) return;
    setSortState(next);
    setPageState(1);
    setIsFetching(true);
  }

  function refetch() {
    setRefetchToken((n) => n + 1);
    setIsFetching(true);
  }

  return {
    items,
    aggregates,
    page,
    pageSize,
    totalItems,
    totalPages,
    sort,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    setSort,
    refetch,
  };
}
