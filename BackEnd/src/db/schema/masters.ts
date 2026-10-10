import { MOTIVO_TIPOS } from '@sdgpd/contracts'
import { type SQL, sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, foreignKey, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies.ts'
import { users } from './identity.ts'

/**
 * Maestros sin dependencias de negocio (BE-2): proveedores, vehículos, choferes y motivos. Alcance
 * EMPRESA, sin sucursal (ADR-BE-002 §Alcances). Todas con RLS forzado (migración 0008), `version`
 * (ADR-BE-005 › Concurrencia) y `UNIQUE (empresa_id, id)` para las FK compuestas que las van a
 * referenciar (productos, órdenes de compra, viajes). Los nombres de columna son los del tipo del
 * frontend en snake_case, sin traducir (ADR-BE-004 › DTO).
 *
 * Unicidad por empresa sobre la forma normalizada (BE-2): el CUIT y la licencia se guardan como los
 * escribió el usuario y se comparan por una columna generada; la patente se guarda ya normalizada
 * (el frontend ya la mostraba así). Las expresiones de normalización son las de `contracts`
 * (`normalizeCuit`, `normalizePatente`, `normalizeLicencia`), escritas en SQL.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}

/** Proveedor (`Supplier`). `active` es nuevo en BE-2. */
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    cuit: text('cuit').notNull(),
    cuitNormalized: text('cuit_normalized')
      .notNull()
      .generatedAlwaysAs((): SQL => sql`regexp_replace(${suppliers.cuit}, '[^0-9]', '', 'g')`),
    phone: text('phone').notNull().default(''),
    contactName: text('contact_name').notNull().default(''),
    contactEmail: text('contact_email').notNull().default(''),
    address: text('address').notNull().default(''),
    city: text('city').notNull().default(''),
    paymentTerms: text('payment_terms').notNull().default(''),
    category: text('category').notNull(),
    active: boolean('active').notNull().default(true),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  t => [
    unique('suppliers_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('suppliers_cuit_uk').on(t.empresaId, t.cuitNormalized),
    check('suppliers_cuit_ck', sql`${t.cuitNormalized} ~ '^[0-9]{11}$'`),
  ],
)

/** Vehículo (`Vehicle`), con su capacidad (`VehicleCapacity`) en columnas. */
export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    patente: text('patente').notNull(),
    tipo: text('tipo').notNull(),
    capacidadBultos: integer('capacidad_bultos').notNull(),
    capacidadPesoKg: doublePrecision('capacidad_peso_kg').notNull(),
    capacidadVolumenM3: doublePrecision('capacidad_volumen_m3').notNull(),
    capacidadRefrigerado: boolean('capacidad_refrigerado').notNull(),
    capacidadZonasHabilitadas: text('capacidad_zonas_habilitadas').array().notNull(),
    activo: boolean('activo').notNull().default(true),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  t => [
    unique('vehicles_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('vehicles_patente_uk').on(t.empresaId, t.patente),
    check('vehicles_patente_normalized_ck', sql`${t.patente} ~ '^[A-Z0-9]{5,10}$'`),
    check(
      'vehicles_capacidad_ck',
      sql`${t.capacidadBultos} >= 0 and ${t.capacidadPesoKg} >= 0 and ${t.capacidadVolumenM3} >= 0 and cardinality(${t.capacidadZonasHabilitadas}) >= 1`,
    ),
  ],
)

/** Chofer (`Driver`), con el usuario de la app opcional (ADR-BE-003, decisión 5). */
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => companies.id),
    nombre: text('nombre').notNull(),
    licencia: text('licencia').notNull(),
    licenciaNormalized: text('licencia_normalized')
      .notNull()
      .generatedAlwaysAs((): SQL => sql`upper(regexp_replace(${drivers.licencia}, '[^A-Za-z0-9]', '', 'g'))`),
    telefono: text('telefono').notNull(),
    activo: boolean('activo').notNull().default(true),
    usuarioId: uuid('usuario_id'),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  t => [
    unique('drivers_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('drivers_licencia_uk').on(t.empresaId, t.licenciaNormalized),
    unique('drivers_usuario_uk').on(t.empresaId, t.usuarioId),
    foreignKey({ name: 'drivers_usuario_fk', columns: [t.empresaId, t.usuarioId], foreignColumns: [users.empresaId, users.id] }),
    check('drivers_licencia_ck', sql`length(${t.licenciaNormalized}) >= 3`),
  ],
)

const motivoTipoList = MOTIVO_TIPOS.map(m => `'${m}'`).join(', ')

/** Motivo del catálogo (`MotivoCatalogItem`, ADR-010 §5). Código único por empresa y tipo. */
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
    ...timestamps,
  },
  t => [
    unique('motivos_empresa_id_id_uk').on(t.empresaId, t.id),
    unique('motivos_tipo_codigo_uk').on(t.empresaId, t.tipo, t.codigo),
    check('motivos_tipo_ck', sql.raw(`"tipo" in (${motivoTipoList})`)),
    check('motivos_codigo_ck', sql`${t.codigo} ~ '^[A-Z][A-Z0-9_]*$'`),
  ],
)
