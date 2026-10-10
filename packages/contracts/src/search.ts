import { z } from 'zod'

/**
 * Búsqueda acotada de un catálogo de selector (ADR-016, ADR-BE-004 › Orden y filtros; BE-2).
 * Reemplaza a los "traer el universo" (`fetchSuppliers`, `fetchActiveVehicles`, `fetchActiveDrivers`).
 * Devuelve hasta `limit` filas y `truncated: true` si había más: quien la usa como diccionario de
 * nombres (documentos viejos que referencian la entidad) sabe que la lista no está completa.
 */
export const SEARCH_MAX_LIMIT = 100
export const SEARCH_DEFAULT_LIMIT = 20

/** `true`/`false` de la query string. */
export const booleanQuerySchema = z.enum(['true', 'false']).transform(v => v === 'true')

/**
 * Parte común de la query de una búsqueda acotada: texto (`q`) y `limit`. Cada recurso le suma su
 * filtro de estado con el nombre de su campo (`active` en proveedores, `activo` en vehículos y
 * choferes) y la cierra con `.strict()`: un parámetro de más es 400 `invalid-query`.
 */
export const searchQueryShape = {
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
}

/** Resultado de una búsqueda acotada: `{ items, truncated }`. */
export function searchResultSchema<Item extends z.ZodType>(item: Item) {
  return z.object({ items: z.array(item).max(SEARCH_MAX_LIMIT), truncated: z.boolean() }).strict()
}
