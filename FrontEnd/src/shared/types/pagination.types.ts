// ============================================================
// SHARED TYPE DEFINITIONS — Contrato de paginacion server-side
// (P1/P2, DECISIONES_TECNICAS.md). Reemplaza el patron anterior de
// "traer el array completo y cortarlo en el cliente": el origen de
// datos (hoy services/mock/*, mañana un backend real) filtra, ordena,
// cuenta y corta el, y devuelve solo la pagina pedida.
// ============================================================

export type SortDirection = 'asc' | 'desc';

export interface PageSort<TSort extends string> {
  field: TSort;
  direction: SortDirection;
}

// TFilters es tipado por cada consumidor (nunca Record<string, unknown>):
// ver DeliveryQueryFilters (logistics) y LowStockQueryFilters (inventory).
export interface PageQuery<TFilters, TSort extends string = string> {
  page: number; // 1-based
  pageSize: number;
  filters: TFilters;
  sort?: PageSort<TSort>;
}

// TAggregates es opcional y tipado por consumidor (P3) — nunca any. Un
// KPI o un contador calculado sobre las 8 filas de una pagina, en un
// dataset de 300.000 registros, es un numero incorrecto en pantalla:
// el origen de datos calcula los agregados sobre TODO lo que matchea
// los filtros (no sobre `items`) y los manda ya resueltos en la
// respuesta. Ningun componente debe calcular un total, un conteo ni un
// promedio sobre `items` — si necesita un numero agregado, tiene que
// salir de `aggregates`, no de recorrer la pagina a mano.
export interface PageResult<TItem, TAggregates = undefined> {
  items: TItem[];
  total: number; // total que matchea los filtros, NO el tamaño del dataset entero
  // Pagina realmente devuelta: puede diferir de la pedida si la pedida
  // quedo fuera de rango (por ejemplo, una mutacion redujo el total y
  // la pagina que se estaba viendo ya no existe) — quien consume el
  // contrato debe confiar en este valor, no en el que pidio.
  page: number;
  pageSize: number;
  aggregates?: TAggregates;
}
