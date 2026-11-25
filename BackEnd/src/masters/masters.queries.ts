import type { Driver, Motivo, Supplier, Vehicle } from '@sdgpd/contracts'
import { type InferSelectModel, type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { auditedEntity } from '../db/command.ts'
import { drivers, motivos, suppliers, vehicles } from '../db/schema/index.ts'
import { toInstant } from '../settings/identity.queries.ts'

/** Entidades auditadas de los maestros de BE-2 (ADR-BE-005 › Auditoría). */
export const supplierEntity = auditedEntity(suppliers, 'supplier')
export const vehicleEntity = auditedEntity(vehicles, 'vehicle')
export const driverEntity = auditedEntity(drivers, 'driver')
export const motivoEntity = auditedEntity(motivos, 'motivo')

/** El CUIT sin guiones ni espacios: lo que se compara para la unicidad por empresa. */
export function cuitDigits(cuit: string): string {
  return cuit.replace(/\D/g, '')
}

/**
 * Condición de búsqueda por texto (ADR-016): contiene `text` (sin distinguir mayúsculas) en alguna de
 * las columnas. Escapa `%`, `_` y `\`: el texto del usuario nunca es un patrón.
 */
export function containsAny(text: string, columns: AnyPgColumn[]): SQL {
  const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`
  return sql.join(
    columns.map(column => sql`${column} ilike ${pattern} escape '\\'`),
    sql` or `,
  )
}

export function toSupplier(row: InferSelectModel<typeof suppliers>): Supplier {
  return {
    id: row.id,
    name: row.name,
    cuit: row.cuit,
    phone: row.phone,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    address: row.address,
    city: row.city,
    paymentTerms: row.paymentTerms,
    category: row.category,
    version: row.version,
    createdAt: toInstant(row.createdAt),
  }
}

export function toVehicle(row: InferSelectModel<typeof vehicles>): Vehicle {
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
    createdAt: toInstant(row.createdAt),
  }
}

export function toDriver(row: InferSelectModel<typeof drivers>): Driver {
  return {
    id: row.id,
    nombre: row.nombre,
    licencia: row.licencia,
    telefono: row.telefono,
    activo: row.activo,
    version: row.version,
    createdAt: toInstant(row.createdAt),
  }
}

export function toMotivo(row: InferSelectModel<typeof motivos>): Motivo {
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    descripcion: row.descripcion,
    activo: row.activo,
    requiereEvidencia: row.requiereEvidencia,
    disparaLogisticaInversa: row.disparaLogisticaInversa,
    version: row.version,
  }
}
