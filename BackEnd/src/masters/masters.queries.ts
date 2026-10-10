import type { DriverContract, MotivoContract, SupplierContract, VehicleContract } from '@sdgpd/contracts'
import { eq, type SQL } from 'drizzle-orm'
import { auditedEntity } from '../db/command.ts'
import { drivers, motivos, suppliers, vehicles } from '../db/schema/index.ts'
import type { TenantTx } from '../db/tenant-tx.ts'

/** Entidades auditadas de los maestros (BE-2). Ninguna tiene columnas secretas. */
export const supplierEntity = auditedEntity(suppliers, 'supplier')
export const vehicleEntity = auditedEntity(vehicles, 'vehicle')
export const driverEntity = auditedEntity(drivers, 'driver')
export const motivoEntity = auditedEntity(motivos, 'motivo')

/** Lecturas: tanto `Database.read()` como `CommandTx` exponen el mismo `select`. */
export type Select = TenantTx['select']

/**
 * Patrón de ILIKE para una búsqueda de texto libre: escapa los comodines (`%`, `_`) y la barra, así
 * el texto del usuario se busca literal ("contiene").
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, c => `\\${c}`)}%`
}

/**
 * Búsqueda acotada (ADR-016, BE-2): pide una fila de más para saber si se truncó, y devuelve hasta
 * `limit` con `truncated`.
 */
export async function bounded<T>(limit: number, fetch: (limit: number) => Promise<T[]>): Promise<{ items: T[]; truncated: boolean }> {
  const rows = await fetch(limit + 1)
  return { items: rows.slice(0, limit), truncated: rows.length > limit }
}

// --- Proveedores ---

export const supplierColumns = {
  id: suppliers.id,
  name: suppliers.name,
  cuit: suppliers.cuit,
  phone: suppliers.phone,
  contactName: suppliers.contactName,
  contactEmail: suppliers.contactEmail,
  address: suppliers.address,
  city: suppliers.city,
  paymentTerms: suppliers.paymentTerms,
  category: suppliers.category,
  active: suppliers.active,
  version: suppliers.version,
}

export function selectSuppliers(select: Select, where: SQL | undefined) {
  return select(supplierColumns).from(suppliers).where(where)
}

export async function findSupplier(select: Select, id: string): Promise<SupplierContract | undefined> {
  return (await selectSuppliers(select, eq(suppliers.id, id)))[0]
}

// --- Vehículos ---

export const vehicleColumns = {
  id: vehicles.id,
  patente: vehicles.patente,
  tipo: vehicles.tipo,
  bultos: vehicles.capacidadBultos,
  pesoKg: vehicles.capacidadPesoKg,
  volumenM3: vehicles.capacidadVolumenM3,
  refrigerado: vehicles.capacidadRefrigerado,
  zonasHabilitadas: vehicles.capacidadZonasHabilitadas,
  activo: vehicles.activo,
  version: vehicles.version,
}
type VehicleRow = {
  id: string
  patente: string
  tipo: string
  bultos: number
  pesoKg: number
  volumenM3: number
  refrigerado: boolean
  zonasHabilitadas: string[]
  activo: boolean
  version: number
}

/** La capacidad viaja anidada, como en `Vehicle` del frontend. */
export function toVehicle(row: VehicleRow): VehicleContract {
  return {
    id: row.id,
    patente: row.patente,
    tipo: row.tipo,
    capacidad: {
      bultos: row.bultos,
      pesoKg: row.pesoKg,
      volumenM3: row.volumenM3,
      refrigerado: row.refrigerado,
      zonasHabilitadas: row.zonasHabilitadas,
    },
    activo: row.activo,
    version: row.version,
  }
}

export function selectVehicles(select: Select, where: SQL | undefined) {
  return select(vehicleColumns).from(vehicles).where(where)
}

export async function findVehicle(select: Select, id: string): Promise<VehicleContract | undefined> {
  const [row] = await selectVehicles(select, eq(vehicles.id, id))
  return row === undefined ? undefined : toVehicle(row)
}

// --- Choferes ---

export const driverColumns = {
  id: drivers.id,
  nombre: drivers.nombre,
  licencia: drivers.licencia,
  telefono: drivers.telefono,
  activo: drivers.activo,
  usuarioId: drivers.usuarioId,
  version: drivers.version,
}

export function selectDrivers(select: Select, where: SQL | undefined) {
  return select(driverColumns).from(drivers).where(where)
}

export async function findDriver(select: Select, id: string): Promise<DriverContract | undefined> {
  return (await selectDrivers(select, eq(drivers.id, id)))[0]
}

// --- Motivos ---

export const motivoColumns = {
  id: motivos.id,
  codigo: motivos.codigo,
  tipo: motivos.tipo,
  descripcion: motivos.descripcion,
  activo: motivos.activo,
  requiereEvidencia: motivos.requiereEvidencia,
  disparaLogisticaInversa: motivos.disparaLogisticaInversa,
  version: motivos.version,
}

export function selectMotivos(select: Select, where: SQL | undefined) {
  return select(motivoColumns).from(motivos).where(where)
}

export async function findMotivo(select: Select, id: string): Promise<MotivoContract | undefined> {
  return (await selectMotivos(select, eq(motivos.id, id)))[0]
}
