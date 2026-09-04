import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { PageQuery, PageResult, PageSort } from '@/shared/types/pagination.types';
import { pagedQueryKey } from '@/shared/api/queryKeys';
import { useSessionStore } from '@/shared/state/useSessionStore';

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
// nuevo en cada render) — esta en la query key (via su `.name`), y
// una referencia anonima/inline no tiene un nombre util para
// distinguir un listado de otro en el cache.
//
// ------------------------------------------------------------
// Tanda 2 de escalabilidad (hallazgo #8, AUDITORIA_ESCALABILIDAD.md):
// por dentro usa TanStack Query (useQuery) en vez de useState+useEffect
// a mano. La firma publica (parametros y forma del objeto devuelto) es
// IDENTICA a la version anterior — ver DECISIONES_TECNICAS.md, decision
// explicita de la tarea: los 7 consumidores existentes no cambian ni
// una linea. Lo que gana por dentro: cache (staleTime/gcTime, no
// repetir un fetch al volver a una pantalla ya visitada), dedupe (dos
// componentes pidiendo la misma pagina con los mismos filtros
// comparten una sola peticion en vuelo — TanStack Query hashea la
// query key por valor, no por referencia) e invalidacion cruzada
// (cambio de sucursal/empresa, ver queryClient.ts).
//
// Compatibilidad de semantica con la version anterior, dos casos que
// necesitaron mapeo explicito (no son 1:1 directos con la API de
// TanStack Query):
//
// 1. `isFetching` mientras `enabled` es false. La version anterior
//    dejaba `isFetching`/`isLoading` TRABADOS en `true` para siempre
//    mientras `enabled` fuera false (el efecto ni corria). TanStack
//    Query, en cambio, pone `fetchStatus: 'idle'` (isFetching: false)
//    cuando `enabled: false` — un cambio de comportamiento real para
//    SuppliersPage (mientras `empresaId` no cargo) y LogisticsPage
//    (mientras `activeBranchId` es null). Se replica a mano:
//    `isFetching = !queryEnabled || query.isFetching`. `isLoading` no
//    necesita el mismo parche: `query.isPending` ya es `true` tanto
//    sin fetch todavia como con `enabled: false`, igual que antes.
//
// 2. `items`/`aggregates` no se vacian mientras se pagina (ver el
//    comentario original de `isFetching` en la interfaz de abajo).
//    `useQuery` por defecto pone `data: undefined` en cuanto cambia la
//    query key (ej. cambiar de pagina). `placeholderData: keepPreviousData`
//    preserva el ultimo resultado exitoso mientras el nuevo esta en
//    vuelo, igual que el comportamiento original.
//
// empresaId SIEMPRE en la query key (barrera de aislamiento
// multi-tenant, ver queryKeys.ts) — se lee de useSessionStore aca
// adentro, no como parametro nuevo (la firma publica no cambia). Esto
// tiene una consecuencia menor y deliberada: los 6 consumidores que
// no tenian ninguna nocion de empresaId hoy pasan a esperar
// implicitamente a que la sesion cargue antes de disparar su primer
// fetch (antes lo disparaban sin esa espera, aunque sus servicios no
// la necesitaran) — mismo criterio ya aplicado en SuppliersPage
// (`enabled: Boolean(empresaId)`) y en el patron de
// GUIA_MIGRACION_MODULO.md, ahora aplicado parejo por el hook mismo
// en vez de que cada consumidor lo repita.
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
  // El segundo parametro (signal) hoy lo reciben todos los fetchPage
  // migrados a la capa api/ (httpClient) — antes de esta tanda algunos
  // no lo usaban de verdad, pero la firma siempre lo acepto (JS/TS
  // permite ignorar argumentos extra). Ahora el signal viene de
  // useQuery, no de un AbortController manual (ver mas abajo).
  fetchPage: (query: PageQuery<TFilters, TSort>, signal: AbortSignal) => Promise<PageResult<TItem, TAggregates>>,
  filters: TFilters,
  options: UsePagedQueryOptions<TSort> = {}
): UsePagedQueryResult<TItem, TSort, TAggregates> {
  const { pageSize: initialPageSize = DEFAULT_PAGE_SIZE, sort: initialSort, enabled = true } = options;

  const empresaId = useSessionStore((s) => s.session?.company.id);

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sort, setSortState] = useState<PageSort<TSort> | undefined>(initialSort);

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
  }

  const queryEnabled = enabled && Boolean(empresaId);

  const query = useQuery({
    queryKey: pagedQueryKey({
      queryName: fetchPage.name,
      empresaId: empresaId ?? '',
      filters: trackedFilters,
      sort,
      page,
      pageSize,
    }),
    // El signal de useQuery reemplaza al AbortController manual de la
    // version anterior: TanStack Query lo cancela solo (query
    // inactiva, componente desmontado, key que cambia sin que quede
    // otro observador de la key vieja) — no se mantienen dos
    // mecanismos de cancelacion en paralelo. Pasa directo a httpClient
    // via fetchPage, igual que antes.
    queryFn: ({ signal }) => fetchPage({ page, pageSize, filters: trackedFilters, sort }, signal),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });

  // Alinea la pagina local a la que realmente devolvio el servidor
  // (PageResult#page puede diferir de la pedida si quedo fuera de
  // rango, ej. una mutacion redujo el total) — mismo criterio que la
  // version anterior, ahora leyendo `query.data` en vez de la promesa
  // resuelta a mano. Guardado por igualdad para no entrar en loop: al
  // corregir `page`, la query key cambia, se vuelve a pedir esa pagina
  // "corregida", y el resultado nuevo ya trae `page` igual al local.
  if (query.data && query.data.page !== page) {
    setPageState(query.data.page);
  }

  const items = query.data?.items ?? [];
  const aggregates = query.data?.aggregates;
  const totalItems = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ver comentario del encabezado, punto 1: sin este OR, `enabled:
  // false` (options.enabled en false, o empresaId todavia sin cargar)
  // haria que isFetching cayera a false en vez de quedar "trabado" en
  // true como en la version anterior.
  const isLoading = query.isPending;
  const isFetching = !queryEnabled || query.isFetching;
  const error = query.error ? (query.error instanceof Error ? query.error.message : 'No se pudo cargar la lista.') : null;

  // setPage/setPageSize/setSort corren en manejadores de eventos
  // (clicks, no efectos) — cambiar el estado local ya alcanza para que
  // la query key cambie y useQuery dispare (o sirva del cache) solo.
  function setPage(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === page) return;
    setPageState(clamped);
  }

  function setPageSize(size: number) {
    if (size === pageSize && page === 1) return;
    setPageSizeState(size);
    setPageState(1);
  }

  function setSort(next: PageSort<TSort> | undefined) {
    const same = next?.field === sort?.field && next?.direction === sort?.direction;
    if (same) return;
    setSortState(next);
    setPageState(1);
  }

  function refetch() {
    void query.refetch();
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
