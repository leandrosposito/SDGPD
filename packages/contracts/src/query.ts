import { z } from 'zod'
import { MAX_PAGE_SIZE } from './pagination.ts'

/** Tamaño de página por defecto de los listados offset. */
export const DEFAULT_PAGE_SIZE = 20
/** Tamaño por defecto de los listados con cursor. */
export const DEFAULT_CURSOR_LIMIT = 50

/** Query de un listado offset (maestros y documentos): `page` desde 1, `pageSize` hasta MAX_PAGE_SIZE. */
export const offsetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

/** Query de un listado con cursor (append-only): `cursor` opaco (ADR-BE-004, sub-decisión 5) y `limit`. */
export const cursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_CURSOR_LIMIT),
})

export const sortDirectionSchema = z.enum(['asc', 'desc'])
export type SortDirection = z.infer<typeof sortDirectionSchema>

/** Lista blanca de un recurso: campos de orden (con el default) y filtros, cada uno con su schema. */
export type ListSpec<SortField extends string, Filters extends z.ZodRawShape> = {
  sortFields: readonly [SortField, ...SortField[]]
  defaultSort: SortField
  defaultDirection?: SortDirection
  filters: Filters
}

function sortShape<SortField extends string>(spec: ListSpec<SortField, z.ZodRawShape>) {
  return {
    sortField: z.enum(spec.sortFields).default(spec.defaultSort),
    sortDirection: sortDirectionSchema.default(spec.defaultDirection ?? 'asc'),
  }
}

/**
 * Query completa de un listado offset con su lista blanca (ADR-BE-004 › Orden y filtros):
 * paginación + `sortField`/`sortDirection` + filtros opcionales. Es `strict`: un parámetro fuera de la
 * lista blanca (o un valor de orden que no está en ella) hace fallar el parse, y el backend lo
 * traduce a 400 `invalid-query`.
 */
export function offsetListQuerySchema<const SortField extends string, Filters extends z.ZodRawShape>(
  spec: ListSpec<SortField, Filters>,
) {
  return offsetQuerySchema.extend(sortShape(spec)).extend(z.object(spec.filters).partial().shape).strict()
}

/** Lo mismo para un listado con cursor. */
export function cursorListQuerySchema<const SortField extends string, Filters extends z.ZodRawShape>(
  spec: ListSpec<SortField, Filters>,
) {
  return cursorQuerySchema.extend(sortShape(spec)).extend(z.object(spec.filters).partial().shape).strict()
}
