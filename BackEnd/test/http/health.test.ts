// GET /health con la aplicación completa (AppModule) contra la base de tests.
import 'reflect-metadata'
import type { Server } from 'node:http'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { errorBodySchema, healthResponseSchema } from '@sdgpd/contracts'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module.ts'
import { configureApp } from '../../src/http/api-prefix.ts'
import { Database } from '../../src/db/database.ts'
import { testConfig } from '../support/db.ts'

let app: INestApplication<Server> | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /health', () => {
  it('responde ok cuando la base contesta, con la forma de contracts y X-Request-Id', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testConfig())] }).compile()
    app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
    configureApp(app)
    await app.init()
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok', database: 'ok' })
    expect(res.headers['x-request-id']).toEqual(expect.any(String))
  })

  it('responde 503 service-unavailable cuando la base no contesta', async () => {
    const down = {
      ping: () => Promise.reject(new Error('connection refused')),
      onModuleDestroy: () => Promise.resolve(),
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testConfig())] })
      .overrideProvider(Database)
      .useValue(down)
      .compile()
    app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
    configureApp(app)
    await app.init()
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(503)
    expect(errorBodySchema.parse(res.body)).toEqual({ code: 'service-unavailable', message: 'La base de datos no responde' })
    expect(res.text).not.toContain('connection refused')
  })
})
