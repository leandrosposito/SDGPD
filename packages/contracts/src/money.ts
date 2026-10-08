import { z } from 'zod'

/** Código de moneda ISO 4217. */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'moneda ISO 4217')
export type Currency = z.infer<typeof currencySchema>

/**
 * Importe en centavos enteros más moneda; no hay floats en el contrato (ADR-BE-006, sub-decisión 3).
 * `z.int()` exige un entero seguro (`Number.isSafeInteger`).
 */
export const moneySchema = z
  .object({
    amount: z.int(),
    currency: currencySchema,
  })
  .strict()
export type Money = z.infer<typeof moneySchema>
