import { MOTIVO_TIPOS } from '@sdgpd/contracts'
import { sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.ts'
import { users } from './identity.ts'

/**
 * Maestros sin dependencias de negocio (BE-2): proveedores, vehículos, choferes y motivos. Alcance
 * EMPRESA (ADR-BE-002 §Alcances: sin `branch_id`). Todos con RLS forzado (migración 0008) y `version`
 * para la concurrencia optimista (ADR-BE-005). Las columnas de texto vacío son `''`, no NULL: el wire
 * nunca lleva null en estos campos.
 */

const motivoTipoList = MOTIVO_TIPOS.map(t => `'${t}'`).join(', ')

/** Proveedor. El CUIT se guarda como lo escribió el usuario; `cuit_digits` (solo dígitos) es el que es único. */
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    cuit: text('cuit').notNull(),
    cuitDigits: text('cuit_digits').notNull(),
    phone: text('phone').notNull().default(''),
    contactName: text('contact_name').notNull().default(''),
    contactEmail: text('contact_email').notNull().default(''),
    address: text('address').notNull().default(''),
    city: text('city').notNull().default(''),
    paymentTerms: text('payment_terms').notNull().default(''),
    category: text('category').notNull().default(''),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [
    unique('suppliers_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('suppliers_cuit_uk').on(t.empresaId, t.cuitDigits),
    check('suppliers_cuit_digits_ck', sql`${t.cuitDigits} ~ '^[0-9]{11}$'`),
    index('suppliers_empresa_name_idx').on(t.empresaId, t.name),
  ],
)

/** Vehículo de la flota. `patente` ya viene normalizada (mayúsculas, sin espacios) y es única por empresa. */
export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    patente: text('patente').notNull(),
    tipo: text('tipo').notNull(),
    bultos: integer('bultos').notNull(),
    pesoKg: doublePrecision('peso_kg').notNull(),
    volumenM3: doublePrecision('volumen_m3').notNull(),
    refrigerado: boolean('refrigerado').notNull(),
    zonasHabilitadas: text('zonas_habilitadas').array().notNull(),
    activo: boolean('activo').notNull().default(true),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [
    unique('vehicles_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('vehicles_patente_uk').on(t.empresaId, t.patente),
    check('vehicles_capacity_ck', sql`${t.bultos} >= 0 and ${t.pesoKg} >= 0 and ${t.volumenM3} >= 0`),
    index('vehicles_empresa_patente_idx').on(t.empresaId, t.patente),
  ],
)

/** Chofer. `usuario_id` (nulo desde el día uno, ADR-BE-003 sub-decisión 5) lo usará la app del chofer. */
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    nombre: text('nombre').notNull(),
    licencia: text('licencia').notNull(),
    telefono: text('telefono').notNull().default(''),
    usuarioId: uuid('usuario_id'),
    activo: boolean('activo').notNull().default(true),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [
    unique('drivers_empresa_id_id_uk').on(t.empresaId, t.id),
    foreignKey({ name: 'drivers_usuario_fk', columns: [t.empresaId, t.usuarioId], foreignColumns: [users.empresaId, users.id] }),
    index('drivers_empresa_nombre_idx').on(t.empresaId, t.nombre),
  ],
)

/** Motivo del catálogo (rechazo, reprogramación, no-entrega). `codigo` es único por empresa y tipo (OTRO se repite). */
export const motivos = pgTable(
  'motivos',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    codigo: text('codigo').notNull(),
    tipo: text('tipo', { enum: MOTIVO_TIPOS }).notNull(),
    descripcion: text('descripcion').notNull(),
    activo: boolean('activo').notNull().default(true),
    requiereEvidencia: boolean('requiere_evidencia').notNull().default(false),
    disparaLogisticaInversa: boolean('dispara_logistica_inversa').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  t => [
    unique('motivos_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('motivos_tipo_codigo_uk').on(t.empresaId, t.tipo, t.codigo),
    check('motivos_tipo_ck', sql.raw(`"tipo" in (${motivoTipoList})`)),
  ],
)
