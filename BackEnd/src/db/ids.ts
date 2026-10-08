import { v7 } from 'uuid'

/**
 * Id nuevo, UUID v7, generado por la aplicación (ADR-BE-004 › Ids).
 * Postgres 17 no tiene uuidv7() nativo (llega en 18): ver ADR-BE-002, sub-decisión 9.
 */
export function newId(): string {
  return v7()
}
