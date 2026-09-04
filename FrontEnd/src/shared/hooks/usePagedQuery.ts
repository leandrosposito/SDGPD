import { useEffect, useState } from 'react';
import type { PageQuery, PageResult, PageSort } from '@/shared/types/pagination.types';
import { ApiError } from '@/shared/api/ApiError';

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
  // El segundo parametro (signal) es opcional para quien lo declara:
  // los fetchPage ya migrados antes de esta tanda (getDeliveriesPage,
  // getLowStockPage, getClientAccountsPage, getOverdueClientsPage,
  // getPurchaseOrdersPage) no lo reciben y siguen funcionando igual
  // (JS/TS permite ignorar argumentos extra) — solo fetchSuppliersPage
  // (Tanda 1, suppliers.service.ts) lo usa de verdad, via httpClient,
  // para cancelacion real con AbortController (mata el hallazgo #9,
  // AUDITORIA_ESCALABILIDAD.md).
  fetchPage: (query: PageQuery<TFilters, TSort>, signal: AbortSignal) => Promise<PageResult<TItem, TAggregates>>,
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
    // AbortController real (ver comentario en la firma de fetchPage):
    // el cleanup de este efecto lo aborta, y para un fetchPage que
    // respeta `signal` (httpClient) eso corta el trabajo en vuelo de
    // verdad, no solo descarta la respuesta cuando llega tarde.
    const controller = new AbortController();
    fetchPage({ page, pageSize, filters: trackedFilters, sort }, controller.signal)
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
        // Una cancelacion real (AbortController, ver arriba) no es un
        // error que mostrar: el efecto ya se va a volver a correr con
        // los parametros nuevos (o ya esta desmontado). Sin este
        // chequeo, escribir rapido en un buscador mostraria "no se
        // pudo cargar" en cada tecla salvo la ultima.
        if (err instanceof ApiError && err.code === 'CANCELLED') return;
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
    // ya usado en el resto del proyecto (InventoryPage, etc.). Se
    // mantiene ademas de `controller.abort()` porque no todo fetchPage
    // respeta `signal` todavia (ver arriba).
    return () => {
      cancelled = true;
      controller.abort();
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
