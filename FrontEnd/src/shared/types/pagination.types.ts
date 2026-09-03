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

// ============================================================
// Filtro de rango de fecha composable (DateRangeFilter, tarea
// transversal 02/09/2026) — cada QueryFilters de un listado en alcance
// extiende esto por interseccion (`& DateRangeQueryFilters`) en vez de
// repetir `dateFrom?`/`dateTo?` sueltos: mismo campo, mismo nombre, en
// todos los servicios que lo soportan. Ambos ISO (yyyy-MM-dd), ambos
// opcionales — filtro inactivo si no vienen. El campo de la ENTIDAD
// contra el que se compara este rango es semanticamente distinto en
// cada servicio (createdAt en OrdenDeCompra, date en Delivery, dueDate
// en facturas de clientes) — ver DECISIONES_TECNICAS.md para el
// razonamiento por modulo, incluida la excepcion de Bajo Stock Minimo
// (sin campo de fecha, no extiende esto).
// ============================================================

export interface DateRangeQueryFilters {
  dateFrom?: string;
  dateTo?: string;
}

// ============================================================
// Exportar (tarea transversal 02/09/2026): traer TODO lo filtrado sin
// paginar, con un tope duro (P1/no hay backend todavia — traer un
// dataset filtrado completo al cliente es deuda tecnica conocida, ver
// DECISIONES_TECNICAS.md). No se modela como PageQuery/PageResult con
// pageSize:'all': ese contrato ya esta en uso por TODOS los modulos
// (migrados y no) y ensancharlo para un caso de uso exclusivo de
// export lo volveria mas ambiguo para el resto. Cada servicio expone
// en cambio una funcion de export propia, que reutiliza (no duplica)
// el mismo filtro+orden que su getXPage.
export const MAX_EXPORT_ROWS = 10_000;

export interface ExportResult<TItem> {
  items: TItem[];
  // true si el total filtrado excedia MAX_EXPORT_ROWS y se corto —
  // quien consume esto debe avisar al usuario (toast), nunca fallar
  // en silencio ni intentar traer el resto.
  truncated: boolean;
}
