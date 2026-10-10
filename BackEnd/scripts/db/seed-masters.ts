// Siembra los maestros de la empresa demo (BE-2) en la transacción del seed, con el tenant ya fijado.
// Idempotente y sin duplicar: inserta cada fila con su id fijo y `on conflict do nothing`, y al final
// verifica que TODOS los ids fijos existan. Si alguno no entró (porque otra fila de la empresa ya tenía
// ese CUIT, esa patente, esa licencia o ese código, por ejemplo cargada a mano desde la UI), falla con un
// mensaje claro: el seed no pisa lo que ya editaste y no inventa otro id.
// Las filas existentes no se actualizan: si editaste un maestro del seed, queda como lo dejaste.
import type pg from 'pg'
import { DEMO_DRIVERS, DEMO_MOTIVOS, DEMO_SUPPLIERS, DEMO_VEHICLES } from './demo-masters.ts'

export type MasterCounts = { suppliers: number; vehicles: number; drivers: number; motivos: number }

async function missingIds(client: pg.Client, table: string, ids: readonly string[]): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(`select id from ${table} where id = any($1::uuid[])`, [ids])
  const found = new Set(rows.map(r => r.id))
  return ids.filter(id => !found.has(id))
}

export async function seedDemoMasters(client: pg.Client, empresaId: string): Promise<MasterCounts> {
  for (const s of DEMO_SUPPLIERS) {
    await client.query(
      `insert into suppliers (id, empresa_id, name, cuit, phone, contact_name, contact_email, address, city, payment_terms, category)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) on conflict do nothing`,
      [s.id, empresaId, s.name, s.cuit, s.phone, s.contactName, s.contactEmail, s.address, s.city, s.paymentTerms, s.category],
    )
  }
  for (const v of DEMO_VEHICLES) {
    const c = v.capacidad
    await client.query(
      `insert into vehicles (id, empresa_id, patente, tipo, capacidad_bultos, capacidad_peso_kg, capacidad_volumen_m3,
                             capacidad_refrigerado, capacidad_zonas_habilitadas)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
      [v.id, empresaId, v.patente, v.tipo, c.bultos, c.pesoKg, c.volumenM3, c.refrigerado, c.zonasHabilitadas],
    )
  }
  for (const d of DEMO_DRIVERS) {
    await client.query(
      'insert into drivers (id, empresa_id, nombre, licencia, telefono) values ($1, $2, $3, $4, $5) on conflict do nothing',
      [d.id, empresaId, d.nombre, d.licencia, d.telefono],
    )
  }
  for (const m of DEMO_MOTIVOS) {
    await client.query(
      `insert into motivos (id, empresa_id, codigo, tipo, descripcion, requiere_evidencia, dispara_logistica_inversa)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
      [m.id, empresaId, m.codigo, m.tipo, m.descripcion, m.requiereEvidencia, m.disparaLogisticaInversa],
    )
  }
  const problems: string[] = []
  const checks: [string, readonly string[]][] = [
    ['suppliers', DEMO_SUPPLIERS.map(s => s.id)],
    ['vehicles', DEMO_VEHICLES.map(v => v.id)],
    ['drivers', DEMO_DRIVERS.map(d => d.id)],
    ['motivos', DEMO_MOTIVOS.map(m => m.id)],
  ]
  for (const [table, ids] of checks) {
    const missing = await missingIds(client, table, ids)
    if (missing.length > 0) problems.push(`${table}: ${missing.join(', ')}`)
  }
  if (problems.length > 0) {
    throw new Error(
      `faltan maestros demo con su id fijo (scripts/db/demo-masters.ts): ${problems.join('; ')}. Otra fila de la empresa ya ` +
        'tiene ese CUIT, esa patente, esa licencia o ese código de motivo: borrala o cambiala y volvé a correr el seed.',
    )
  }
  const { rows } = await client.query<MasterCounts>(
    `select (select count(*) from suppliers)::int as suppliers, (select count(*) from vehicles)::int as vehicles,
            (select count(*) from drivers)::int as drivers, (select count(*) from motivos)::int as motivos`,
  )
  const counts = rows[0]
  if (counts === undefined) throw new Error('no se pudieron contar los maestros')
  return counts
}
