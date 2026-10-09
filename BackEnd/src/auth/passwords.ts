import { hash, verify } from '@node-rs/argon2'

/**
 * argon2id con los parámetros mínimos de OWASP vigentes (Password Storage Cheat Sheet, 2026-10-09):
 * 19 MiB de memoria, 2 iteraciones, paralelismo 1 (ADR-BE-003, sub-decisión 8). El hash es la cadena
 * PHC (`$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>`): lleva los parámetros adentro, así que subirlos
 * después no rompe los hashes viejos (verify los lee de la cadena).
 */
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const
const ARGON2ID_PREFIX = '$argon2id$'

export async function hashPassword(password: string): Promise<string> {
  // El algoritmo por defecto de @node-rs/argon2 es argon2id; se verifica igual, por si cambia.
  const phc = await hash(password, ARGON2_OPTIONS)
  if (!phc.startsWith(ARGON2ID_PREFIX)) throw new Error('hashPassword: el hash no es argon2id')
  return phc
}

/** Compara en tiempo constante. Un hash ilegible cuenta como contraseña incorrecta. */
export async function verifyPassword(phc: string, password: string): Promise<boolean> {
  try {
    return await verify(phc, password)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | undefined

/**
 * Para un email inexistente: verifica contra un hash cualquiera con los mismos parámetros, así la
 * respuesta tarda lo mismo que con un email real y el tiempo no revela qué emails existen.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('sdgpd: hash de relleno para emails inexistentes')
  await verifyPassword(await dummyHash, password)
}
