import { z } from 'zod'
import { idSchema } from './id.ts'
import { offsetPageSchema } from './pagination.ts'
import { offsetListQuerySchema } from './query.ts'

/** Sucursal (`Branch` del frontend, `session.types.ts`). Sin `empresaId` (ADR-BE-002, sub-decisión 5). */
export const branchSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    code: z.string(),
    city: z.string(),
    address: z.string(),
    status: z.enum(['active', 'inactive']),
  })
  .strict()
export type Branch = z.infer<typeof branchSchema>

/** GET /branches: lista blanca. */
export const branchListQuerySchema = offsetListQuerySchema({
  sortFields: ['code', 'name'],
  defaultSort: 'code',
  filters: { status: z.enum(['active', 'inactive']) },
})
export type BranchListQuery = z.infer<typeof branchListQuerySchema>

export const branchPageSchema = offsetPageSchema(branchSchema)
export type BranchPage = z.infer<typeof branchPageSchema>
