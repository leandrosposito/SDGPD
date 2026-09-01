import { useEffect, useState } from 'react';

// ============================================================
// useDebouncedValue — Devuelve `value` recien despues de que pasen
// `delayMs` sin que cambie (M6, DECISIONES_TECNICAS.md). Patron de
// busqueda del proyecto: generico y sin conocimiento de dominio, para
// que cualquier input que dispare un fetch server-side (nombre/CUIT de
// clientes hoy, cualquier otro buscador despues) lo reuse en vez de
// reimplementar su propio setTimeout local.
//
// Uso tipico: el input queda controlado por el valor CRUDO (sin
// demora, la tipeada se siente instantanea) y el fetch/filtro server-
// side usa el valor devuelto por este hook.
//   const [search, setSearch] = useState('');
//   const debouncedSearch = useDebouncedValue(search, 300);
//   const filters = useMemo(() => ({ search: debouncedSearch }), [debouncedSearch]);
// ============================================================

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
