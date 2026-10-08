import { z } from 'zod'

/** `GET /health`: endpoint operativo, sin recurso de negocio. */
export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    database: z.literal('ok'),
  })
  .strict()
export type HealthResponse = z.infer<typeof healthResponseSchema>
