// Filtro global de errores y X-Request-Id: toda respuesta de error es { code, message, details? }
// con el status de ADR-BE-004, y lo no previsto es 500 internal-error sin filtrar detalles.
import 'reflect-metadata'
import type { Server } from 'node:http'
import { Body, Controller, Get, type INestApplication, Post } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { errorBodySchema } from '@sdgpd/contracts'
import request from 'supertest'
import { validate as isUuid, version as uuidVersion } from 'uuid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { configureApp } from '../../src/http/api-prefix.ts'
import { BusinessRuleError } from '../../src/http/errors.ts'
import { HttpCoreModule } from '../../src/http/http.module.ts'
import { ZodValidationPipe } from '../../src/http/zod-validation.pipe.ts'

const probeBodySchema = z.object({ name: z.string().min(1), quantity: z.int().positive() }).strict()
type ProbeBody = z.infer<typeof probeBodySchema>
const SECRET = 'detalle-interno-que-no-debe-salir'

@Controller('probe')
class ProbeController {
  @Post('validation')
  validation(@Body(new ZodValidationPipe(probeBodySchema)) body: ProbeBody): ProbeBody {
    return body
  }

  @Get('business')
  business(): never {
    throw new BusinessRuleError('invalid-transition', 'La transición no es válida', { from: 'creado', to: 'cerrado' })
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error(SECRET)
  }
}

let app: INestApplication<Server>

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [HttpCoreModule],
    controllers: [ProbeController],
  }).compile()
  app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
  configureApp(app)
  await app.init()
})

afterAll(async () => {
  await app?.close()
})

function expectErrorBody(res: request.Response, status: number, code: string): void {
  expect(res.status).toBe(status)
  expect(res.headers['content-type']).toMatch(/application\/json/)
  const parsed = errorBodySchema.safeParse(res.body)
  expect(parsed.success, JSON.stringify(res.body)).toBe(true)
  expect(res.body).toMatchObject({ code })
}

describe('filtro global de errores', () => {
  it('error de validación → 400 validation-error con los issues en details', async () => {
    const res = await request(app.getHttpServer()).post('/api/probe/validation').send({ name: '', quantity: 1.5 })
    expectErrorBody(res, 400, 'validation-error')
    const paths = (res.body as { details: { issues: { path: string[] }[] } }).details.issues.map(i => i.path.join('.'))
    expect(paths.sort()).toEqual(['name', 'quantity'])
  })

  it('un body válido pasa el pipe y llega transformado', async () => {
    const res = await request(app.getHttpServer()).post('/api/probe/validation').send({ name: 'ok', quantity: 2 })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ name: 'ok', quantity: 2 })
  })

  it('JSON mal formado → 400 validation-error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/probe/validation')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
    expectErrorBody(res, 400, 'validation-error')
  })

  it('error de negocio → 422 con su code y details', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe/business')
    expectErrorBody(res, 422, 'invalid-transition')
    expect(res.body).toEqual({
      code: 'invalid-transition',
      message: 'La transición no es válida',
      details: { from: 'creado', to: 'cerrado' },
    })
  })

  it('error no previsto → 500 internal-error, sin stack ni mensaje interno en el cuerpo', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe/unexpected')
    expectErrorBody(res, 500, 'internal-error')
    expect(res.body).toEqual({ code: 'internal-error', message: 'Error interno del servidor' })
    expect(res.text).not.toContain(SECRET)
    expect(res.text).not.toMatch(/stack|at .*\.ts/i)
  })

  it('ruta inexistente → 404 not-found', async () => {
    const res = await request(app.getHttpServer()).get('/api/no-existe')
    expectErrorBody(res, 404, 'not-found')
  })
})

describe('X-Request-Id', () => {
  it('cada respuesta, también las de error, trae un UUID v7 distinto', async () => {
    const server = app.getHttpServer()
    const responses = await Promise.all([
      request(server).post('/api/probe/validation').send({ name: 'ok', quantity: 1 }),
      request(server).get('/api/probe/business'),
      request(server).get('/api/probe/unexpected'),
      request(server).get('/api/no-existe'),
    ])
    const ids = responses.map(r => r.headers['x-request-id'])
    for (const id of ids) {
      expect(typeof id === 'string' && isUuid(id) && uuidVersion(id) === 7, String(id)).toBe(true)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el id que manda el cliente no reemplaza al del servidor', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe/business').set('X-Request-Id', 'del-cliente-123')
    expect(res.headers['x-request-id']).not.toBe('del-cliente-123')
    expect(uuidVersion(String(res.headers['x-request-id']))).toBe(7)
  })
})
