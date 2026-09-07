import { useSearchParams } from 'react-router-dom';
import type { PageSort, SortDirection } from '@/shared/types/pagination.types';

// ============================================================
// useUrlListState — Tanda 4 (corrida completa, A13 hallazgo ALTO #1):
// hook compartido para que pagina, orden, busqueda y filtros propios
// de un listado vivan en la URL (los search params) en vez de en un
// useState local — "pegar una URL con filtros reproduce el listado
// exacto".
//
// Se usa junto a usePagedQuery pasando page/sort como CONTROLADOS
// (options.page + options.onPageChange, options.sort + options.onSortChange,
// ver usePagedQuery.ts) — este hook es la fuente de verdad, usePagedQuery
// solo la refleja.
//
// `prefix` namespacea los params cuando dos listados con este mismo
// hook conviven potencialmente en la misma URL (ej. las 4 tabs de
// Inventario: 'stock', 'mov', 'hist', 'bajo' — cada una con su propio
// `?stock_page=`, `?mov_page=`, etc. en vez de pisarse un `?page=`
// compartido). Los listados que son la unica tab paginada de su pagina
// (ej. Pedidos, Caja, Proveedores) pueden omitir `prefix`.
//
// IMPORTANTE: ComprasPage.tsx ya usa useSearchParams para un mecanismo
// de deep-link DISTINTO (params `proveedor`/`producto`/`sucursal`, de
// traspaso de accion entre pantallas, ver AUDIT_13_RUTAS.md hallazgo
// MEDIO #2) — cualquier uso de este hook en ese archivo (o en
// TabPendingReceipt, montado dentro de el) debe usar nombres de filtro
// que NO choquen con esos tres, y se recomienda `prefix` igual.
//
// Las funciones de parseo/serializacion de pagina y orden son puras y
// se exportan por separado (parsePageParam, parseSortParam,
// serializeSortParam) para poder ejercitarlas en un smoke script sin
// React ni un DOM real — ver scripts/smoke/tanda-4.smoke.mjs.
// ============================================================

export function parsePageParam(raw: string | null | undefined): number {
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export function serializePageParam(page: number): string | undefined {
  // pagina 1 es el default: se omite de la URL para no ensuciarla con
  // el caso mas comun (?page=1 en cada listado apenas se abre).
  return page > 1 ? String(page) : undefined;
}

function isSortDirection(value: string): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function parseSortParam<TSort extends string>(
  raw: string | null | undefined,
  allowedFields?: readonly TSort[]
): PageSort<TSort> | undefined {
  if (!raw) return undefined;

  const separatorIndex = raw.lastIndexOf(':');
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) return undefined;

  const field = raw.slice(0, separatorIndex);
  const direction = raw.slice(separatorIndex + 1);

  if (!isSortDirection(direction)) return undefined;
  if (allowedFields && !allowedFields.includes(field as TSort)) return undefined;

  return { field: field as TSort, direction };
}

export function serializeSortParam<TSort extends string>(sort: PageSort<TSort> | undefined): string | undefined {
  return sort ? `${sort.field}:${sort.direction}` : undefined;
}

export interface UseUrlListStateOptions<TSort extends string, TFilterKey extends string> {
  // Namespace de los params de este listado (ver comentario de arriba).
  prefix?: string;
  // Whitelist de campos de orden validos — un valor de URL que no este
  // en esta lista se descarta (undefined) en vez de aceptarse a ciegas.
  // Omitir si el listado no tiene orden.
  sortFields?: readonly TSort[];
  // Nombres de los filtros de texto propios del listado (busqueda,
  // estado, rango de fecha ya serializado, etc.) — cada uno se lee/
  // escribe como un string plano en la URL.
  filterKeys?: readonly TFilterKey[];
}

export interface UseUrlListStateResult<TSort extends string, TFilterKey extends string> {
  page: number;
  setPage: (page: number) => void;
  sort: PageSort<TSort> | undefined;
  setSort: (sort: PageSort<TSort> | undefined) => void;
  filters: Partial<Record<TFilterKey, string>>;
  // Actualiza un filtro y vuelve la pagina a 1 (mismo criterio que
  // usePagedQuery aplicaba internamente al cambiar filtros/orden en
  // modo no controlado) — un cambio de filtro nunca deja al usuario
  // "en la pagina 3 de un resultado que ya no tiene 3 paginas".
  setFilter: (key: TFilterKey, value: string | undefined) => void;
  // Actualiza VARIOS filtros a la vez en una sola escritura a la URL
  // (ej. un DateRangeValue completo: preset+dateFrom+dateTo) — evita 3
  // llamadas seguidas a setSearchParams, que podrian no componerse
  // entre si de forma segura dentro del mismo handler de evento.
  setFilters: (patch: Partial<Record<TFilterKey, string | undefined>>) => void;
}

export function useUrlListState<TSort extends string = never, TFilterKey extends string = never>(
  options: UseUrlListStateOptions<TSort, TFilterKey> = {}
): UseUrlListStateResult<TSort, TFilterKey> {
  const { prefix, sortFields, filterKeys = [] } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  function paramName(name: string): string {
    return prefix ? `${prefix}_${name}` : name;
  }

  const page = parsePageParam(searchParams.get(paramName('page')));
  const sort = parseSortParam<TSort>(searchParams.get(paramName('sort')), sortFields);

  const filters: Partial<Record<TFilterKey, string>> = {};
  for (const key of filterKeys) {
    const value = searchParams.get(paramName(key));
    if (value) filters[key] = value;
  }

  function applyParams(mutate: (params: URLSearchParams) => void, resetPage: boolean) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        if (resetPage) next.delete(paramName('page'));
        return next;
      },
      { replace: true }
    );
  }

  function setPage(next: number) {
    applyParams((params) => {
      const serialized = serializePageParam(next);
      if (serialized === undefined) params.delete(paramName('page'));
      else params.set(paramName('page'), serialized);
    }, false);
  }

  function setSort(next: PageSort<TSort> | undefined) {
    applyParams((params) => {
      const serialized = serializeSortParam(next);
      if (serialized === undefined) params.delete(paramName('sort'));
      else params.set(paramName('sort'), serialized);
    }, true);
  }

  function setFilter(key: TFilterKey, value: string | undefined) {
    applyParams((params) => {
      if (!value) params.delete(paramName(key));
      else params.set(paramName(key), value);
    }, true);
  }

  function setFilters(patch: Partial<Record<TFilterKey, string | undefined>>) {
    applyParams((params) => {
      for (const key of Object.keys(patch) as TFilterKey[]) {
        const value = patch[key];
        if (!value) params.delete(paramName(key));
        else params.set(paramName(key), value);
      }
    }, true);
  }

  return { page, setPage, sort, setSort, filters, setFilter, setFilters };
}
