import { useMemo, useState } from 'react';

// ============================================================
// usePagination — Paginacion generica en memoria para cualquier
// listado. Consume un array ya filtrado/ordenado y devuelve solo
// los items de la pagina actual. El dia que la lista se resuelva
// contra una API paginada, solo cambia de donde sale `items`
// (y `setPage` puede pasar a disparar el fetch de esa pagina) sin
// tocar los componentes que consumen el resultado de este hook.
// ============================================================

interface UsePaginationResult<T> {
  pageItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  setPage: (page: number) => void;
}

export function usePagination<T>(
  items: T[],
  pageSize: number,
  resetKey?: unknown
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey);

  // Vuelve a la primera pagina cuando cambia el criterio de filtrado
  // (resetKey), para no quedar en una pagina vacia tras filtrar.
  // Se ajusta durante el render (no en un efecto), siguiendo el patron
  // de React para "adjusting state when a prop changes":
  // https://react.dev/learn/you-might-not-need-an-effect
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey);
    setCurrentPage(1);
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  function setPage(page: number) {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  }

  return { pageItems, currentPage: safePage, totalPages, totalItems, setPage };
}
