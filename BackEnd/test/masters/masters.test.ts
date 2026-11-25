// BE-2: proveedores, vehículos, choferes y motivos, de punta a punta contra sdgpd_test (AppModule real).
import {
  driverPageSchema,
  driverSchema,
  errorBodySchema,
  motivoListSchema,
  motivoSchema,
  supplierPageSchema,
  supplierSchema,
  vehiclePageSchema,
  vehicleSchema,
} from '@sdgpd/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_MOTIVOS } from '../../src/masters/default-motivos.ts'
import { motivos } from '../../src/db/schema/index.ts'
import { newId } from '../../src/db/ids.ts'
import {
  type AuthApp,
  createAuthApp,
  createFixtureCompany,
  type FixtureCompany,
  get,
  loginOk,
  removeFixtureCompany,
  send,
} from '../support/auth-app.ts'

let app: AuthApp
let A: FixtureCompany
let B: FixtureCompany
let adminA: string
let adminB: string
let limitedA: string

beforeAll(async () => {
  app = await createAuthApp()
  A = await createFixtureCompany(app.database, 'ma')
  B = await createFixtureCompany(app.database, 'mb')
  adminA = (await loginOk(app, A.admin.email)).accessToken
  adminB = (await loginOk(app, B.admin.email)).accessToken
  limitedA = (await loginOk(app, A.limited.email)).accessToken
  // El catálogo inicial de motivos de la empresa A (lo que hace db:seed-dev).
  await app.database.withTenant(A.empresaId, async tx => {
    for (const m of DEFAULT_MOTIVOS) await tx.insert(motivos).values({ id: newId(), empresaId: A.empresaId, ...m })
  })
})

afterAll(async () => {
  try {
    await removeFixtureCompany(app.database, A)
    await removeFixtureCompany(app.database, B)
  } finally {
    await app?.app.close()
  }
})

const code = (res: { body: unknown }): string => errorBodySchema.parse(res.body).code

describe('proveedores', () => {
  it('alta, lectura y edición parcial con versión', async () => {
    const created = await send(app, 'post', '/suppliers', adminA, { name: 'Distribuidora Sur', cuit: '30-71234567-8', category: 'Bebidas' })
    expect(created.status).toBe(201)
    const supplier = supplierSchema.parse(created.body)
    expect(supplier).toMatchObject({ name: 'Distribuidora Sur', cuit: '30-71234567-8', category: 'Bebidas', phone: '', version: 1 })

    const updated = await send(app, 'put', `/suppliers/${supplier.id}`, adminA, { phone: '351 555-0000', version: 1 })
    expect(updated.status).toBe(200)
    expect(supplierSchema.parse(updated.body)).toMatchObject({ name: 'Distribuidora Sur', phone: '351 555-0000', version: 2 })

    const stale = await send(app, 'put', `/suppliers/${supplier.id}`, adminA, { phone: 'otro', version: 1 })
    expect(stale.status).toBe(409)
    expect(code(stale)).toBe('version-conflict')
  })

  it('el CUIT es único por empresa comparado sin guiones, y repetible entre empresas', async () => {
    const first = await send(app, 'post', '/suppliers', adminA, { name: 'Uno', cuit: '20-11111111-1' })
    expect(first.status).toBe(201)
    const dup = await send(app, 'post', '/suppliers', adminA, { name: 'Dos', cuit: '20111111111' })
    expect(dup.status).toBe(422)
    expect(code(dup)).toBe('cuit-duplicado')
    expect((await send(app, 'post', '/suppliers', adminB, { name: 'Uno en B', cuit: '20-11111111-1' })).status).toBe(201)

    const other = supplierSchema.parse((await send(app, 'post', '/suppliers', adminA, { name: 'Tres', cuit: '20-22222222-2' })).body)
    const clash = await send(app, 'put', `/suppliers/${other.id}`, adminA, { cuit: '20-11111111-1', version: other.version })
    expect(clash.status).toBe(422)
    expect(code(clash)).toBe('cuit-duplicado')
  })

  it('valida el CUIT y rechaza campos desconocidos', async () => {
    expect((await send(app, 'post', '/suppliers', adminA, { name: 'X', cuit: '123' })).status).toBe(400)
    expect((await send(app, 'post', '/suppliers', adminA, { name: 'X', cuit: '20-33333333-3', empresaId: newId() })).status).toBe(400)
  })

  it('lista con búsqueda (el texto no es un patrón), orden y filtro; solo ve su empresa', async () => {
    await send(app, 'post', '/suppliers', adminA, { name: '100% Natural', cuit: '20-44444444-4', category: 'Naturales' })
    const found = supplierPageSchema.parse((await get(app, '/suppliers?search=100%25&sortField=name', adminA)).body)
    expect(found.items.map(s => s.name)).toEqual(['100% Natural'])
    const wildcard = supplierPageSchema.parse((await get(app, '/suppliers?search=%25', adminA)).body)
    expect(wildcard.items.map(s => s.name)).toEqual(['100% Natural'])
    const byCategory = supplierPageSchema.parse((await get(app, '/suppliers?category=Naturales', adminA)).body)
    expect(byCategory.total).toBe(1)
    const inB = supplierPageSchema.parse((await get(app, '/suppliers?pageSize=100', adminB)).body)
    expect(inB.items.map(s => s.name)).toEqual(['Uno en B'])
    expect(code(await get(app, '/suppliers?sortField=saldo', adminA))).toBe('invalid-query')
  })

  it('un proveedor de otra empresa no existe (404) y sin permiso es 403', async () => {
    const inA = supplierPageSchema.parse((await get(app, '/suppliers?pageSize=1', adminA)).body).items[0]
    expect((await get(app, `/suppliers/${inA?.id}`, adminB)).status).toBe(404)
    expect((await send(app, 'put', `/suppliers/${inA?.id}`, adminB, { phone: 'x', version: 1 })).status).toBe(404)
    expect((await get(app, '/suppliers', limitedA)).status).toBe(403)
    expect((await send(app, 'post', '/suppliers', limitedA, { name: 'X', cuit: '20-55555555-5' })).status).toBe(403)
  })
})

const capacidad = { bultos: 80, pesoKg: 1200, volumenM3: 6, refrigerado: false, zonasHabilitadas: ['Norte', 'Centro'] }

describe('vehículos', () => {
  it('normaliza la patente, rechaza la repetida y la deja repetir en otra empresa', async () => {
    const created = await send(app, 'post', '/vehicles', adminA, { patente: 'ab 123 cd', tipo: 'Camioneta', capacidad })
    expect(created.status).toBe(201)
    const vehicle = vehicleSchema.parse(created.body)
    expect(vehicle).toMatchObject({ patente: 'AB123CD', activo: true, version: 1, capacidad })

    const dup = await send(app, 'post', '/vehicles', adminA, { patente: 'AB123CD', tipo: 'Otro', capacidad })
    expect(dup.status).toBe(422)
    expect(code(dup)).toBe('patente-duplicada')
    expect((await send(app, 'post', '/vehicles', adminB, { patente: 'AB123CD', tipo: 'Camioneta', capacidad })).status).toBe(201)
  })

  it('edita con versión y la patente de otro vehículo es duplicada', async () => {
    const a = vehicleSchema.parse((await send(app, 'post', '/vehicles', adminA, { patente: 'AC456EF', tipo: 'Camión', capacidad })).body)
    const edited = await send(app, 'put', `/vehicles/${a.id}`, adminA, { patente: 'AC456EF', tipo: 'Camión refrigerado', capacidad: { ...capacidad, refrigerado: true }, version: a.version })
    expect(edited.status).toBe(200)
    expect(vehicleSchema.parse(edited.body)).toMatchObject({ tipo: 'Camión refrigerado', version: 2 })
    const clash = await send(app, 'put', `/vehicles/${a.id}`, adminA, { patente: 'ab123cd', tipo: 'x', capacidad, version: 2 })
    expect(code(clash)).toBe('patente-duplicada')
    expect(code(await send(app, 'put', `/vehicles/${a.id}`, adminA, { patente: 'AC456EF', tipo: 'x', capacidad, version: 1 }))).toBe('version-conflict')
  })

  it('desactiva y reactiva con la versión leída, y soloActivos filtra', async () => {
    const v = vehicleSchema.parse((await send(app, 'post', '/vehicles', adminA, { patente: 'AD789GH', tipo: 'Furgón', capacidad })).body)
    const off = await send(app, 'post', `/vehicles/${v.id}/deactivate`, adminA, { version: v.version })
    expect(off.status).toBe(201)
    expect(vehicleSchema.parse(off.body)).toMatchObject({ activo: false, version: 2 })
    const active = vehiclePageSchema.parse((await get(app, '/vehicles?soloActivos=true&pageSize=100', adminA)).body)
    expect(active.items.some(x => x.id === v.id)).toBe(false)
    const all = vehiclePageSchema.parse((await get(app, '/vehicles?pageSize=100', adminA)).body)
    expect(all.items.some(x => x.id === v.id)).toBe(true)
    const on = await send(app, 'post', `/vehicles/${v.id}/activate`, adminA, { version: 2 })
    expect(vehicleSchema.parse(on.body).activo).toBe(true)
    expect(code(await send(app, 'post', `/vehicles/${v.id}/activate`, adminA, { version: 2 }))).toBe('version-conflict')
  })

  it('valida la capacidad, aísla por empresa y exige permiso', async () => {
    expect((await send(app, 'post', '/vehicles', adminA, { patente: 'ZZ111ZZ', tipo: 'x', capacidad: { ...capacidad, bultos: -1 } })).status).toBe(400)
    const inA = vehiclePageSchema.parse((await get(app, '/vehicles?pageSize=1', adminA)).body).items[0]
    expect((await get(app, `/vehicles/${inA?.id}`, adminB)).status).toBe(404)
    expect((await send(app, 'post', `/vehicles/${inA?.id}/deactivate`, adminB, { version: 1 })).status).toBe(404)
    expect((await get(app, '/vehicles', limitedA)).status).toBe(403)
  })
})

describe('choferes', () => {
  it('alta, edición, baja y alta lógica, con búsqueda', async () => {
    const created = await send(app, 'post', '/drivers', adminA, { nombre: 'Carlos Fernández', licencia: 'B-1234567' })
    expect(created.status).toBe(201)
    const driver = driverSchema.parse(created.body)
    expect(driver).toMatchObject({ telefono: '', activo: true, version: 1 })

    const edited = driverSchema.parse((await send(app, 'put', `/drivers/${driver.id}`, adminA, { nombre: 'Carlos Fernández', licencia: 'B-1234567', telefono: '+54 11 5551-0001', version: 1 })).body)
    expect(edited).toMatchObject({ telefono: '+54 11 5551-0001', version: 2 })
    expect(code(await send(app, 'put', `/drivers/${driver.id}`, adminA, { nombre: 'x', licencia: 'y', telefono: '', version: 1 }))).toBe('version-conflict')

    const off = driverSchema.parse((await send(app, 'post', `/drivers/${driver.id}/deactivate`, adminA, { version: 2 })).body)
    expect(off.activo).toBe(false)
    expect(driverPageSchema.parse((await get(app, '/drivers?soloActivos=true&search=carlos', adminA)).body).total).toBe(0)
    expect(driverPageSchema.parse((await get(app, '/drivers?search=carlos', adminA)).body).total).toBe(1)
    expect(driverSchema.parse((await send(app, 'post', `/drivers/${driver.id}/activate`, adminA, { version: 3 })).body).activo).toBe(true)
  })

  it('aísla por empresa y exige permiso', async () => {
    const inA = driverPageSchema.parse((await get(app, '/drivers?pageSize=1', adminA)).body).items[0]
    expect((await get(app, `/drivers/${inA?.id}`, adminB)).status).toBe(404)
    expect(driverPageSchema.parse((await get(app, '/drivers', adminB)).body).total).toBe(0)
    expect((await get(app, '/drivers', limitedA)).status).toBe(403)
  })
})

describe('motivos', () => {
  it('devuelve el catálogo sembrado, por tipo y solo activos por defecto', async () => {
    const all = motivoListSchema.parse((await get(app, '/motivos?soloActivos=false', adminA)).body)
    expect(all.items).toHaveLength(DEFAULT_MOTIVOS.length)
    const rechazo = motivoListSchema.parse((await get(app, '/motivos?tipo=rechazo', adminA)).body)
    expect(rechazo.items.every(m => m.tipo === 'rechazo')).toBe(true)
    expect(rechazo.items.find(m => m.codigo === 'MERCADERIA_DANADA')).toMatchObject({ requiereEvidencia: true, disparaLogisticaInversa: true })
    expect(motivoListSchema.parse((await get(app, '/motivos', adminB)).body).items).toEqual([])
    expect((await get(app, '/motivos', limitedA)).status).toBe(403)
    expect(code(await get(app, '/motivos?tipo=inexistente', adminA))).toBe('invalid-query')
  })

  it('edita descripción, activo y banderas con versión; no cambia código ni tipo', async () => {
    const otro = motivoListSchema.parse((await get(app, '/motivos?tipo=reprogramacion', adminA)).body).items.find(m => m.codigo === 'CLIMA')
    expect(otro).toBeDefined()
    const res = await send(app, 'put', `/motivos/${otro?.id}`, adminA, { descripcion: 'Clima adverso', activo: false, requiereEvidencia: true, disparaLogisticaInversa: false, version: otro?.version })
    expect(res.status).toBe(200)
    expect(motivoSchema.parse(res.body)).toMatchObject({ codigo: 'CLIMA', tipo: 'reprogramacion', descripcion: 'Clima adverso', activo: false, version: 2 })
    expect(motivoListSchema.parse((await get(app, '/motivos?tipo=reprogramacion', adminA)).body).items.some(m => m.codigo === 'CLIMA')).toBe(false)
    expect((await send(app, 'put', `/motivos/${otro?.id}`, adminA, { codigo: 'X', descripcion: 'x', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false, version: 2 })).status).toBe(400)
    expect((await send(app, 'put', `/motivos/${otro?.id}`, adminB, { descripcion: 'x', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false, version: 2 })).status).toBe(404)
    expect((await send(app, 'put', `/motivos/${otro?.id}`, limitedA, { descripcion: 'x', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false, version: 2 })).status).toBe(403)
  })
})
