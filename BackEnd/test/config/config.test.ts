import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../../src/config/config.ts'

const CA = process.env.DATABASE_CA_CERT
const URL_WITH_SECRET = 'postgresql://sdgpd_app.ref:s3cr3t-pw@db.example.test:5432/postgres'

describe('loadConfig', () => {
  it('con todas las variables, devuelve la config tipada', () => {
    const config = loadConfig({ PORT: '3000', DATABASE_URL: URL_WITH_SECRET, DATABASE_CA_CERT: CA })
    expect(config.port).toBe(3000)
    expect(config.database.url).toBe(URL_WITH_SECRET)
    expect(config.database.caCert).toContain('BEGIN CERTIFICATE')
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
