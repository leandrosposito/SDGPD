import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../../src/config/config.ts'

const CA = process.env.DATABASE_CA_CERT
const URL_WITH_SECRET = 'postgresql://sdgpd_app.ref:s3cr3t-pw@db.example.test:5432/postgres'
/** Clave de prueba (no es la de .env): 32 bytes en base64url. Desde BE-1a, JWT_SECRET es obligatoria. */
const JWT_SECRET = Buffer.alloc(32, 7).toString('base64url')

describe('loadConfig', () => {
  it('con todas las variables, devuelve la config tipada', () => {
    const config = loadConfig({ PORT: '3000', DATABASE_URL: URL_WITH_SECRET, DATABASE_CA_CERT: CA, JWT_SECRET })
    expect(config.port).toBe(3000)
    expect(config.database.url).toBe(URL_WITH_SECRET)
    expect(config.database.caCert).toContain('BEGIN CERTIFICATE')
    expect(config.auth.jwtSecret).toHaveLength(32)
  })

  it('sin JWT_SECRET, o con una de menos de 32 bytes, falla nombrándola y sin mostrar el valor', () => {
    const base = { PORT: '3000', DATABASE_URL: URL_WITH_SECRET, DATABASE_CA_CERT: CA }
    expect(() => loadConfig(base)).toThrow(/JWT_SECRET/)
    const short = Buffer.alloc(16, 9).toString('base64url')
    let message = ''
    try {
      loadConfig({ ...base, JWT_SECRET: short })
    } catch (err) {
      message = err instanceof Error ? err.message : ''
    }
    expect(message).toMatch(/JWT_SECRET/)
    expect(message).not.toContain(short)
  })

  it('si falta una variable, falla nombrándola', () => {
    expect(() => loadConfig({ PORT: '3000', DATABASE_CA_CERT: CA })).toThrow(ConfigError)
    expect(() => loadConfig({ PORT: '3000', DATABASE_CA_CERT: CA })).toThrow(/DATABASE_URL/)
    expect(() => loadConfig({})).toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*DATABASE_CA_CERT/)
  })

  it('rechaza SSL en la URL (lo fija la aplicación, siempre verificado) sin mostrar la URL', () => {
    let message = ''
    try {
      loadConfig({ PORT: '3000', DATABASE_URL: `${URL_WITH_SECRET}?sslmode=disable`, DATABASE_CA_CERT: CA })
    } catch (err) {
      message = err instanceof Error ? err.message : ''
    }
    expect(message).toMatch(/SSL/)
    expect(message).not.toContain('s3cr3t-pw')
  })

  it('rechaza un certificado inexistente y una URL sin contraseña', () => {
    expect(() =>
      loadConfig({ PORT: '3000', DATABASE_URL: URL_WITH_SECRET, DATABASE_CA_CERT: 'no/existe.crt' }),
    ).toThrow(/DATABASE_CA_CERT/)
    expect(() =>
      loadConfig({ PORT: '3000', DATABASE_URL: 'postgresql://u@h:5432/db', DATABASE_CA_CERT: CA }),
    ).toThrow(/DATABASE_URL/)
  })
})
