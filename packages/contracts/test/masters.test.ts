import { describe, expect, it } from 'vitest'
import {
  createDriverRequestSchema,
  createSupplierRequestSchema,
  createVehicleRequestSchema,
  motivoListQuerySchema,
  normalizePatente,
  supplierListQuerySchema,
  updateMotivoRequestSchema,
  updateSupplierRequestSchema,
  vehicleListQuerySchema,
} from '../src/index.ts'

const capacidad = { bultos: 10, pesoKg: 100.5, volumenM3: 2, refrigerado: false, zonasHabilitadas: ['Norte'] }

describe('proveedores', () => {
  it('el alta exige razón social y CUIT, y completa el resto con vacío', () => {
    const parsed = createSupplierRequestSchema.parse({ name: ' Distribuidora ', cuit: '30-71234567-8' })
    expect(parsed).toMatchObject({ name: 'Distribuidora', phone: '', contactEmail: '', category: '' })
  })

  it('acepta el CUIT con o sin guiones y rechaza lo que no es un CUIT', () => {
    expect(createSupplierRequestSchema.safeParse({ name: 'A', cuit: '30712345678' }).success).toBe(true)
    for (const cuit of ['123', '30-7123456-78', 'ab-cdefghij-k', '']) {
      expect(createSupplierRequestSchema.safeParse({ name: 'A', cuit }).success).toBe(false)
    }
  })

  it('el email puede estar vacío, se normaliza y se valida', () => {
    expect(createSupplierRequestSchema.parse({ name: 'A', cuit: '30712345678', contactEmail: ' Ventas@Prov.COM ' }).contactEmail).toBe('ventas@prov.com')
    expect(createSupplierRequestSchema.safeParse({ name: 'A', cuit: '30712345678', contactEmail: 'no-es-mail' }).success).toBe(false)
  })

  it('no acepta empresaId ni campos desconocidos (ADR-BE-002)', () => {
    expect(createSupplierRequestSchema.safeParse({ name: 'A', cuit: '30712345678', empresaId: '0192f000-0000-7000-8000-000000000001' }).success).toBe(false)
  })

  it('la edición es parcial pero exige la versión', () => {
    expect(updateSupplierRequestSchema.safeParse({ phone: '1', version: 3 }).success).toBe(true)
    expect(updateSupplierRequestSchema.safeParse({ phone: '1' }).success).toBe(false)
    expect(updateSupplierRequestSchema.safeParse({ phone: '1', version: 0 }).success).toBe(false)
  })

  it('la query tiene lista blanca de orden y filtros', () => {
    expect(supplierListQuerySchema.parse({}).sortField).toBe('name')
    expect(supplierListQuerySchema.safeParse({ sortField: 'currentBalance' }).success).toBe(false)
    expect(supplierListQuerySchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('vehículos', () => {
  it('normaliza la patente: mayúsculas y sin espacios', () => {
    expect(normalizePatente(' ab 123  cd ')).toBe('AB123CD')
    expect(createVehicleRequestSchema.parse({ patente: 'ab 123 cd', tipo: 'Camioneta', capacidad }).patente).toBe('AB123CD')
  })

  it('rechaza patentes inválidas y capacidades negativas o no finitas', () => {
    expect(createVehicleRequestSchema.safeParse({ patente: 'A-1', tipo: 'x', capacidad }).success).toBe(false)
    expect(createVehicleRequestSchema.safeParse({ patente: 'AB123CD', tipo: 'x', capacidad: { ...capacidad, bultos: -1 } }).success).toBe(false)
    expect(createVehicleRequestSchema.safeParse({ patente: 'AB123CD', tipo: 'x', capacidad: { ...capacidad, pesoKg: Infinity } }).success).toBe(false)
    expect(createVehicleRequestSchema.safeParse({ patente: 'AB123CD', tipo: 'x', capacidad: { ...capacidad, bultos: 1.5 } }).success).toBe(false)
  })

  it('soloActivos viaja como texto y llega como booleano', () => {
    expect(vehicleListQuerySchema.parse({ soloActivos: 'true' }).soloActivos).toBe(true)
    expect(vehicleListQuerySchema.parse({ soloActivos: 'false' }).soloActivos).toBe(false)
    expect(vehicleListQuerySchema.safeParse({ soloActivos: 'si' }).success).toBe(false)
  })
})

describe('choferes', () => {
  it('el teléfono es opcional en el alta', () => {
    expect(createDriverRequestSchema.parse({ nombre: 'Marina', licencia: 'B-2345678' }).telefono).toBe('')
    expect(createDriverRequestSchema.safeParse({ nombre: '', licencia: 'B-1' }).success).toBe(false)
  })
})

describe('motivos', () => {
  it('por defecto solo activos, y el tipo está en la lista cerrada', () => {
    expect(motivoListQuerySchema.parse({}).soloActivos).toBe(true)
    expect(motivoListQuerySchema.parse({ tipo: 'no-entrega', soloActivos: 'false' })).toEqual({ tipo: 'no-entrega', soloActivos: false })
    expect(motivoListQuerySchema.safeParse({ tipo: 'otro' }).success).toBe(false)
  })

  it('la edición no admite cambiar el código ni el tipo', () => {
    const base = { descripcion: 'x', activo: true, requiereEvidencia: false, disparaLogisticaInversa: false, version: 1 }
    expect(updateMotivoRequestSchema.safeParse(base).success).toBe(true)
    expect(updateMotivoRequestSchema.safeParse({ ...base, codigo: 'NUEVO' }).success).toBe(false)
    expect(updateMotivoRequestSchema.safeParse({ ...base, tipo: 'rechazo' }).success).toBe(false)
  })
})
