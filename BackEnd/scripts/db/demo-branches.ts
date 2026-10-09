// Sucursales con id fijo para el seed de desarrollo (BE-1b). Corre dentro de la transacción del seed,
// con el tenant ya fijado. Lo usa scripts/db/seed-dev.ts y lo prueba test/db/demo-branches.test.ts.
import type pg from 'pg'
import type { DemoBranch } from './demo-ids.ts'

/** Resultado por sucursal: creada, ya estaba con su id, o migrada desde otro id. */
export type DemoBranchOutcome = { code: string; outcome: 'created' | 'kept' | 'migrated'; fromId?: string }

export class DemoBranchConflictError extends Error {
  override readonly name = 'DemoBranchConflictError'
}

/**
 * Deja cada sucursal con su id fijo, sin duplicarla:
 * - si no existe ninguna con ese código, la crea con el id fijo;
 * - si existe con el id fijo, no la toca (no pisa lo que hayas editado);
 * - si existe con OTRO id (el seed de BE-1a generaba ids aleatorios), la migra: crea la del id fijo con
 *   los mismos datos, mueve las sucursales habilitadas de los usuarios y borra la vieja. Si la vieja
 *   tiene otras referencias, el borrado falla por FK y la transacción entera se revierte;
 * - si el id fijo ya lo usa una sucursal con otro código, falla con un mensaje claro.
 */
export async function ensureDemoBranches(
  client: pg.Client,
  empresaId: string,
  branches: readonly DemoBranch[],
): Promise<DemoBranchOutcome[]> {
  const outcomes: DemoBranchOutcome[] = []
  for (const b of branches) {
    const byId = await client.query<{ code: string }>('select code from branches where id = $1', [b.id])
    const byCode = await client.query<{ id: string }>('select id from branches where code = $1', [b.code])
    const ownerOfId = byId.rows[0]
    const holder = byCode.rows[0]
    if (ownerOfId !== undefined && ownerOfId.code !== b.code) {
      throw new DemoBranchConflictError(
        `el id fijo ${b.id} (sucursal ${b.code}) ya lo usa la sucursal ${ownerOfId.code}: revisá las sucursales de la empresa demo`,
      )
    }
    if (holder === undefined) {
      await client.query(
        'insert into branches (id, empresa_id, name, code, city, address, status) values ($1, $2, $3, $4, $5, $6, $7)',
        [b.id, empresaId, b.name, b.code, b.city, b.address, b.status],
      )
      outcomes.push({ code: b.code, outcome: 'created' })
      continue
    }
    if (holder.id === b.id) {
      outcomes.push({ code: b.code, outcome: 'kept' })
      continue
    }
    // Migración: liberar el código, crear la del id fijo con los datos de la vieja, mover las referencias
    // conocidas (sucursales habilitadas) y borrar la vieja.
    const old = holder.id
    await client.query(`update branches set code = code || '#migrando' where id = $1`, [old])
    await client.query(
      `insert into branches (id, empresa_id, name, code, city, address, status, version)
       select $1, empresa_id, name, $2, city, address, status, version from branches where id = $3`,
      [b.id, b.code, old],
    )
    await client.query('update user_branches set branch_id = $1 where branch_id = $2', [b.id, old])
    try {
      await client.query('delete from branches where id = $1', [old])
    } catch (err) {
      throw new DemoBranchConflictError(
        `no se pudo migrar la sucursal ${b.code} de ${old} a ${b.id}: la vieja tiene otras referencias (${err instanceof Error ? err.message : String(err)})`,
      )
    }
    outcomes.push({ code: b.code, outcome: 'migrated', fromId: old })
  }
  return outcomes
}
