import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import {
  cursorPageSchema,
  dateSchema,
  errorBodySchema,
  idSchema,
  instantSchema,
  MAX_PAGE_SIZE,
  moneySchema,
  offsetPageSchema,
  transversalErrorCodes,
  type ErrorBody,
} from '../src/index.ts'

describe('idSchema', () => {
  it('acepta un UUID v7 y rechaza el prefijo legado', () => {
    expect(idSchema.safeParse('01928f6e-7b2a-7c3d-8e4f-5a6b7c8d9e0f').success).toBe(true)
    expect(idSchema.safeParse('ord-001').success).toBe(false)
  })
})

describe('errorBodySchema', () => {
  it('acepta { code, message } y { code, message, details }', () => {
    expect(errorBodySchema.safeParse({ code: 'not-found', message: 'No existe' }).success).toBe(true)
    expect(
      errorBodySchema.safeParse({ code: 'version-conflict', message: 'x', details: { currentVersion: 3 } })
        .success,
    ).toBe(true)
  })
  it('rechaza code que no es kebab-case, message vacío y campos de más', () => {
    expect(errorBodySchema.safeParse({ code: 'NotFound', message: 'x' }).success).toBe(false)
    expect(errorBodySchema.safeParse({ code: 'not-found', message: '' }).success).toBe(false)
    expect(errorBodySchema.safeParse({ code: 'not-found', message: 'x', stack: '...' }).success).toBe(false)
  })
  it('todos los códigos transversales son kebab-case válidos', () => {
    for (const code of Object.keys(transversalErrorCodes)) {
      expect(errorBodySchema.safeParse({ code, message: 'x' }).success, code).toBe(true)
    }
  })
  it('el tipo inferido es { code, message, details? }', () => {
    expectTypeOf<ErrorBody>().toEqualTypeOf<{
      code: string
      message: string
      details?: Record<string, unknown> | undefined
    }>()
  })
})

describe('envoltorios de página', () => {
  const item = z.object({ id: idSchema })
  const offset = offsetPageSchema(item)
  const cursor = cursorPageSchema(item, z.object({ count: z.int() }))

  it('offset: acepta una página válida y aplica el tope de pageSize', () => {
    expect(offset.safeParse({ items: [], total: 0, page: 1, pageSize: 20 }).success).toBe(true)
    expect(offset.safeParse({ items: [], total: 0, page: 1, pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false)
    expect(offset.safeParse({ items: [], total: 0, page: 0, pageSize: 20 }).success).toBe(false)
    expect(offset.safeParse({ items: [], total: 1.5, page: 1, pageSize: 20 }).success).toBe(false)
  })
  it('offset sin schema de aggregates no acepta aggregates', () => {
    expect(offset.safeParse({ items: [], total: 0, page: 1, pageSize: 20, aggregates: {} }).success).toBe(false)
  })
  it('cursor: nextCursor string o null, aggregates tipado', () => {
    expect(cursor.safeParse({ items: [], nextCursor: null }).success).toBe(true)
    expect(cursor.safeParse({ items: [], nextCursor: 'abc', aggregates: { count: 2 } }).success).toBe(true)
    expect(cursor.safeParse({ items: [], nextCursor: '' }).success).toBe(false)
    expect(cursor.safeParse({ items: [] }).success).toBe(false)
  })
})

describe('fechas e instantes', () => {
  it('dateSchema: yyyy-MM-dd y fecha real', () => {
    expect(dateSchema.safeParse('2026-10-08').success).toBe(true)
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(dateSchema.safeParse('08/10/2026').success).toBe(false)
  })
  it('instantSchema: ISO 8601 en UTC, sin offset', () => {
    expect(instantSchema.safeParse('2026-10-08T15:30:00Z').success).toBe(true)
    expect(instantSchema.safeParse('2026-10-08T15:30:00.123Z').success).toBe(true)
    expect(instantSchema.safeParse('2026-10-08T12:30:00-03:00').success).toBe(false)
    expect(instantSchema.safeParse('2026-10-08T15:30:00').success).toBe(false)
  })
})

describe('moneySchema', () => {
  it('centavos enteros más moneda ISO', () => {
    expect(moneySchema.safeParse({ amount: 123456, currency: 'ARS' }).success).toBe(true)
    expect(moneySchema.safeParse({ amount: -500, currency: 'USD' }).success).toBe(true)
  })
  it('rechaza floats, monedas mal formadas y enteros no seguros', () => {
    expect(moneySchema.safeParse({ amount: 1234.56, currency: 'ARS' }).success).toBe(false)
    expect(moneySchema.safeParse({ amount: 100, currency: 'ars' }).success).toBe(false)
    expect(moneySchema.safeParse({ amount: Number.MAX_SAFE_INTEGER + 1, currency: 'ARS' }).success).toBe(false)
  })
})
