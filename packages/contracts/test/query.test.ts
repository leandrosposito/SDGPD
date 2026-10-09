import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  cursorListQuerySchema,
  cursorQuerySchema,
  DEFAULT_CURSOR_LIMIT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  offsetListQuerySchema,
  offsetQuerySchema,
  transversalErrorCodes,
  versionSchema,
} from '../src/index.ts'

describe('offsetQuerySchema / cursorQuerySchema', () => {
  it('coerce desde la query string y aplica defaults', () => {
    expect(offsetQuerySchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
    expect(offsetQuerySchema.parse({ page: '3', pageSize: '100' })).toEqual({ page: 3, pageSize: 100 })
    expect(cursorQuerySchema.parse({})).toEqual({ limit: DEFAULT_CURSOR_LIMIT })
  })
  it(`rechaza pageSize/limit mayor a ${MAX_PAGE_SIZE}, page 0 y no enteros`, () => {
    expect(offsetQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
    expect(offsetQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(offsetQuerySchema.safeParse({ page: '1.5' }).success).toBe(false)
    expect(cursorQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(cursorQuerySchema.safeParse({ cursor: '' }).success).toBe(false)
  })
})

describe('listas blancas', () => {
  const offset = offsetListQuerySchema({
    sortFields: ['name', 'code'],
    defaultSort: 'name',
    filters: { status: z.enum(['active', 'inactive']) },
  })
  const cursor = cursorListQuerySchema({ sortFields: ['at'], defaultSort: 'at', defaultDirection: 'desc', filters: {} })

  it('acepta los campos de la lista blanca, con defaults de orden', () => {
    expect(offset.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sortField: 'name', sortDirection: 'asc' })
    expect(offset.parse({ sortField: 'code', sortDirection: 'desc', status: 'active', page: '2' })).toEqual({
      page: 2,
      pageSize: DEFAULT_PAGE_SIZE,
      sortField: 'code',
      sortDirection: 'desc',
      status: 'active',
    })
    expect(cursor.parse({ cursor: 'abc' })).toEqual({ cursor: 'abc', limit: DEFAULT_CURSOR_LIMIT, sortField: 'at', sortDirection: 'desc' })
  })

  it('rechaza un campo de orden, un filtro o un parámetro fuera de la lista blanca', () => {
    expect(offset.safeParse({ sortField: 'address' }).success).toBe(false)
    expect(offset.safeParse({ status: 'borrada' }).success).toBe(false)
    expect(offset.safeParse({ city: 'Córdoba' }).success).toBe(false)
    expect(offset.safeParse({ empresaId: 'x' }).success).toBe(false)
    expect(cursor.safeParse({ page: '1' }).success).toBe(false)
  })
})

describe('versión y códigos de BE-0b', () => {
  it('versionSchema: entero desde 1', () => {
    expect(versionSchema.safeParse(1).success).toBe(true)
    expect(versionSchema.safeParse(0).success).toBe(false)
    expect(versionSchema.safeParse(1.5).success).toBe(false)
  })
  it('los códigos nuevos tienen el status de ADR-BE-004/005', () => {
    expect(transversalErrorCodes).toMatchObject({
      'idempotency-key-required': 400,
      'invalid-query': 400,
      'idempotency-key-in-progress': 409,
      'idempotency-key-reused': 422,
    })
  })
})
