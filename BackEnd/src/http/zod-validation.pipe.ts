import { Injectable, type PipeTransform } from '@nestjs/common'
import type { z } from 'zod'
import { ValidationError } from './errors.ts'

/**
 * Valida y transforma con un schema de contracts (ADR-BE-001, sub-decisión 4).
 * Uso: `@Body(new ZodValidationPipe(createXSchema)) body: CreateX`.
 * El error lleva los issues de Zod en `details.issues` (path, code, message), sin el valor recibido.
 */
@Injectable()
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data
    throw new ValidationError('El request no es válido', {
      issues: result.error.issues.map(i => ({ path: i.path.map(String), code: i.code, message: i.message })),
    })
  }
}
