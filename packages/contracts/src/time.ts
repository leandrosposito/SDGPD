import { z } from 'zod'

/** Fecha sin hora, `yyyy-MM-dd`, validada como fecha real (ADR-BE-004 › Fechas). */
export const dateSchema = z.iso.date()
export type IsoDate = z.infer<typeof dateSchema>

/** Instante en ISO 8601 UTC, con `Z` y sin offset (ADR-BE-004 › Fechas). */
export const instantSchema = z.iso.datetime({ offset: false, local: false })
export type Instant = z.infer<typeof instantSchema>
