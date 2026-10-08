import type { SortDirection } from '@sdgpd/contracts'
import { asc, desc, type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { InvalidQueryError } from '../http/errors.ts'

/**
 * Página offset (ADR-BE-004 › Paginación): `{ items, total, page, pageSize }`. La consulta la arma el
 * recurso con sus tipos concretos; el helper solo orquesta el conteo y la ventana.
 */
export async function offsetPage<T>(params: {
  page: number
  pageSize: number
  count: () => Promise<number>
  fetch: (limit: number, offset: number) => Promise<T[]>
}): Promise<{ items: T[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize } = params
  const [total, items] = await Promise.all([params.count(), params.fetch(pageSize, (page - 1) * pageSize)])
  return { items, total, page, pageSize }
}

/** Posición de un registro en el orden del cursor: instante de negocio + id (ADR-BE-004, sub-decisión 5). */
export type CursorKey = { at: string; id: string }

const cursorKeySchema = z.tuple([z.string().min(1), z.uuid()])

/** Cursor opaco: base64url de `[at, id]`. */
export function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify([key.at, key.id]), 'utf8').toString('base64url')
}

/** Un cursor que no se puede decodificar es una query inválida (400 `invalid-query`). */
export function decodeCursor(cursor: string): CursorKey {
  try {
    const [at, id] = cursorKeySchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
    if (Number.isNaN(Date.parse(at))) throw new Error('instante inválido')
    return { at, id }
  } catch {
    throw new InvalidQueryError({ issues: [{ path: ['cursor'], code: 'invalid-cursor', message: 'Cursor inválido' }] })
  }
}

/**
 * Página con cursor (keyset sobre `(instante, id)`): `{ items, nextCursor }`. Pide `limit + 1` para
 * saber si hay más; `nextCursor` es la posición del último item devuelto, o `null` al final.
 */
export async function cursorPage<T>(params: {
  cursor: string | undefined
  limit: number
  fetch: (after: CursorKey | null, limit: number) => Promise<T[]>
  keyOf: (item: T) => CursorKey
}): Promise<{ items: T[]; nextCursor: string | null }> {
  const after = params.cursor === undefined ? null : decodeCursor(params.cursor)
  const rows = await params.fetch(after, params.limit + 1)
  const items = rows.slice(0, params.limit)
  const last = items.at(-1)
  const nextCursor = rows.length > params.limit && last !== undefined ? encodeCursor(params.keyOf(last)) : null
  return { items, nextCursor }
}

/** Condición keyset: estrictamente después de `after` en el orden `(at, id)` y la dirección dada. */
export function keysetAfter(
  at: AnyPgColumn,
  id: AnyPgColumn,
  after: CursorKey | null,
  direction: SortDirection,
): SQL | undefined {
  if (after === null) return undefined
  return direction === 'asc'
    ? sql`(${at}, ${id}) > (${after.at}::timestamptz, ${after.id}::uuid)`
    : sql`(${at}, ${id}) < (${after.at}::timestamptz, ${after.id}::uuid)`
}

/** ORDER BY del keyset, coherente con keysetAfter. */
export function keysetOrder(at: AnyPgColumn, id: AnyPgColumn, direction: SortDirection): SQL[] {
  return direction === 'asc' ? [asc(at), asc(id)] : [desc(at), desc(id)]
}

/**
 * ORDER BY de un listado offset a partir de la lista blanca: el `Record` obliga a mapear a una
 * columna cada campo de orden permitido, y el id desempata para que el orden sea total.
 */
export function orderByWhitelist<Field extends string>(
  columns: Record<Field, AnyPgColumn>,
  field: Field,
  direction: SortDirection,
  tieBreaker: AnyPgColumn,
): SQL[] {
  const by = direction === 'asc' ? asc : desc
  return [by(columns[field]), by(tieBreaker)]
}
