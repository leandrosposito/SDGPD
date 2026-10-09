import { Injectable, type PipeTransform } from '@nestjs/common'
import type { z } from 'zod'
import { InvalidQueryError } from './errors.ts'

/**
 * Valida la query de un listado contra su lista blanca de contracts (`offsetListQuerySchema` o
 * `cursorListQuerySchema`). Un filtro, un campo de orden o un parámetro que no está en la lista
 * blanca es 400 `invalid-query` (ADR-BE-004 › Orden y filtros).
 * Uso: `@Query(new ListQueryPipe(branchListQuery)) query: BranchListQuery`.
 */
@Injectable()
export class ListQueryPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data
    throw new InvalidQueryError({
      issues: result.error.issues.map(i => ({ path: i.path.map(String), code: i.code, message: i.message })),
    })
  }
}
