/** SQLSTATE 23505: unique_violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * ¿El error (o su causa: Drizzle envuelve el de pg en `cause`) es la violación de la restricción
 * única `constraint`? Sirve para traducir, por ejemplo, el email repetido a un 409 con su código.
 */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    if ('code' in current && current.code === UNIQUE_VIOLATION && 'constraint' in current && current.constraint === constraint) {
      return true
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}
