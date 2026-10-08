import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'

/** URL de Postgres con usuario y contraseña, sin parámetros de SSL: el SSL lo fija la aplicación, siempre verificado. */
export const postgresUrlSchema = z
  .url({ protocol: /^postgres(ql)?$/ })
  .refine(u => {
    const url = new URL(u)
    return url.username !== '' && url.password !== ''
  }, 'la URL tiene que tener usuario y contraseña')
  .refine(u => !/[?&](ssl|sslmode|sslrootcert|sslcert|sslkey)=/i.test(u), 'el SSL no va en la URL: lo fija DATABASE_CA_CERT')

/** Conexiones por proceso. La base es remota (pooler de Supabase en modo sesión): pocas. */
const DEFAULT_POOL_SIZE = 5

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: postgresUrlSchema,
  DATABASE_CA_CERT: z.string().min(1).refine(p => existsSync(p), 'el archivo del certificado no existe'),
})

export type AppConfig = {
  port: number
  database: { url: string; caCert: string; maxConnections: number }
}

/** Valida el entorno al arrancar (ADR-BE-001, sub-decisión 5): si falta una variable, el proceso no levanta. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    // Nunca se incluye el valor recibido: puede ser una URL con contraseña.
    const problems = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new ConfigError(`Configuración inválida:\n${problems}`)
  }
  return {
    port: parsed.data.PORT,
    database: {
      url: parsed.data.DATABASE_URL,
      caCert: readFileSync(parsed.data.DATABASE_CA_CERT, 'utf8'),
      maxConnections: DEFAULT_POOL_SIZE,
    },
  }
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError'
}

/** Token de inyección de la configuración validada. */
export const APP_CONFIG = Symbol('APP_CONFIG')
