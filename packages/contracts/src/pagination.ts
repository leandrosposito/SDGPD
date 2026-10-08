import { z } from 'zod'

/** Tope de `pageSize` en los listados offset (ADR-BE-004 › Paginación; PROTOCOLO §3.1). */
export const MAX_PAGE_SIZE = 100

/**
 * Envoltorio offset, para maestros y documentos: `{ items, total, page, pageSize, aggregates? }`.
 * El tipo de cada página se infiere del schema armado: `z.infer<typeof miPaginaSchema>`.
 */
export function offsetPageSchema<Item extends z.ZodType, Aggregates extends z.ZodType = z.ZodNever>(
  item: Item,
  aggregates?: Aggregates,
) {
  return z
    .object({
      items: z.array(item).max(MAX_PAGE_SIZE),
      total: z.int().nonnegative(),
      page: z.int().min(1),
      pageSize: z.int().min(1).max(MAX_PAGE_SIZE),
      aggregates: (aggregates ?? z.never()).optional(),
    })
    .strict()
}

/**
 * Envoltorio cursor, obligatorio en los registros append-only: `{ items, nextCursor, aggregates? }`.
 * `nextCursor` es opaco (ADR-BE-004, sub-decisión 5) y vale `null` en la última página.
 */
export function cursorPageSchema<Item extends z.ZodType, Aggregates extends z.ZodType = z.ZodNever>(
  item: Item,
  aggregates?: Aggregates,
) {
  return z
    .object({
      items: z.array(item).max(MAX_PAGE_SIZE),
      nextCursor: z.string().min(1).nullable(),
      aggregates: (aggregates ?? z.never()).optional(),
    })
    .strict()
}
