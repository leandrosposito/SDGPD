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

/**
 * Claves del servidor en base64url, de al menos 256 bits. Las genera db:setup (o `-- --secrets-only`):
 * JWT_SECRET firma el access token (ADR-BE-003, sub-decisión 2); IDEMPOTENCY_HMAC_KEY es la clave del
 * HMAC del payload de idempotencia (ADR-BE-005, BE-1b).
 */
const SECRET_MIN_BYTES = 32
const secretKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, 'tiene que ser base64url')
  .transform(s => new Uint8Array(Buffer.from(s, 'base64url')))
  .refine(key => key.length >= SECRET_MIN_BYTES, `tiene que tener al menos ${SECRET_MIN_BYTES} bytes`)

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: postgresUrlSchema,
  DATABASE_CA_CERT: z.string().min(1).refine(p => existsSync(p), 'el archivo del certificado no existe'),
  JWT_SECRET: secretKeySchema,
  IDEMPOTENCY_HMAC_KEY: secretKeySchema,
})

export type AppConfig = {
  port: number
  database: { url: string; caCert: string; maxConnections: number }
  /** Clave del access token. Vive solo en BackEnd/.env: nunca va a un log ni a una respuesta. */
  auth: { jwtSecret: Uint8Array }
  /** Clave del HMAC del payload de idempotencia. Vive solo en BackEnd/.env. */
  idempotency: { hmacKey: Uint8Array }
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
    auth: { jwtSecret: parsed.data.JWT_SECRET },
    idempotency: { hmacKey: parsed.data.IDEMPOTENCY_HMAC_KEY },
  }
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError'
}

/** Token de inyección de la configuración validada. */
export const APP_CONFIG = Symbol('APP_CONFIG')
