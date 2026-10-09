import { and, Column, eq, getTableColumns, type InferInsertModel, type InferSelectModel, sql } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { Actor } from '../context/actor.ts'
import { ConflictError, NotFoundError } from '../http/errors.ts'
import { nextNumber } from './counters.ts'
import { newId } from './ids.ts'
import { revokeUserRefreshTokens } from './refresh-tokens.ts'
import { auditLog, type AuditAction, type DocumentSeries } from './schema/index.ts'
import type { TenantTx } from './tenant-tx.ts'

/** Tabla de negocio con `id` y `empresa_id`. */
export type TenantTable = PgTable & { id: AnyPgColumn; empresaId: AnyPgColumn }
/** Agregado editable: además lleva `version` (ADR-BE-005 › Concurrencia). */
export type VersionedTable = TenantTable & { version: AnyPgColumn }

/** Una entidad auditada: su tabla, su nombre en audit_log y las columnas que nunca se auditan. */
export type AuditedEntity<T extends TenantTable> = {
  readonly table: T
  readonly name: string
  /** Propiedades de la fila que no van a before/after (hash de contraseña, tokens: ADR-BE-005 sub-decisión 7). */
  readonly secretColumns: readonly string[]
}

export function auditedEntity<T extends TenantTable>(
  table: T,
  name: string,
  secretColumns: readonly (keyof InferSelectModel<T> & string)[] = [],
): AuditedEntity<T> {
  return { table, name, secretColumns }
}

/** Valor de un campo de un objeto, sin suponer su tipo. */
function fieldOf(row: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(row, key)?.value
}

type RawRow = Record<string, unknown>

/** La fila completa (nombres de columna de la base), sin las columnas secretas, para before/after. */
function snapshot(row: RawRow, secretColumnNames: readonly string[]): RawRow {
  return Object.fromEntries(Object.entries(row).filter(([column]) => !secretColumnNames.includes(column)))
}

/** Resultado de una escritura: el id de la fila y su versión nueva (si la tabla es versionada). */
export type WriteResult = { id: string; version: number | null }

/**
 * Lo único que recibe el código de un comando (ADR-BE-005 › Transacciones): la transacción con el
 * tenant fijado, envuelta. Expone lecturas (`select`), escrituras que SIEMPRE dejan su registro en
 * audit_log (insert, update con versión, delete con versión) y la numeración. El cliente Drizzle
 * crudo es privado: con estos helpers no hay forma de escribir sin auditoría.
 *
 * Las escrituras devuelven id y versión, no la fila: quien necesita la fila la lee con `select`
 * sobre su tabla concreta, con tipos exactos (el tipado genérico de Drizzle no resuelve el resultado
 * de `returning()` sobre una tabla genérica, y no se tapa con casts: PROTOCOLO regla 2.4).
 */
export class CommandTx {
  readonly #tx: TenantTx
  readonly actor: Actor

  constructor(tx: TenantTx, actor: Actor) {
    this.#tx = tx
    this.actor = actor
  }

  /** Lecturas dentro de la transacción del comando. */
  get select(): TenantTx['select'] {
    return this.#tx.select.bind(this.#tx)
  }

  /** Inserta y audita (`create`, after = la fila insertada). */
  async insert<T extends TenantTable>(entity: AuditedEntity<T>, values: InferInsertModel<T>): Promise<WriteResult> {
    const id = fieldOf(values, 'id')
    if (typeof id !== 'string') throw new Error(`insert en ${entity.name}: el id lo genera el servidor (newId) y es obligatorio`)
    await this.#tx.insert(entity.table).values(values)
    const after = await this.#row(entity, id, false)
    if (after === undefined) throw new Error(`insert en ${entity.name}: la fila no quedó visible`)
    await this.#audit('create', entity, id, null, after)
    return { id, version: versionOf(after) }
  }

  /**
   * Actualiza con versión esperada (ADR-BE-005 › Concurrencia) y audita (`update`, before y after):
   * `UPDATE … SET …, version = version + 1 WHERE id = $id AND version = $esperada`.
   * Si no actualiza nada: 404 si la fila no existe, 409 `version-conflict` con `details.currentVersion` si existe.
   */
  async update<T extends VersionedTable>(
    entity: AuditedEntity<T>,
    id: string,
    expectedVersion: number,
    changes: Partial<InferInsertModel<T>>,
  ): Promise<WriteResult> {
    const { table } = entity
    const before = await this.#row(entity, id, true)
    const result = await this.#tx
      .update(table)
      .set({ ...changes, version: sql`${table.version} + 1` })
      .where(and(eq(table.id, id), eq(table.version, expectedVersion)))
    if (result.rowCount !== 1) throw this.#missOrConflict(entity, before)
    const after = await this.#row(entity, id, false)
    if (after === undefined) throw new Error(`update en ${entity.name}: la fila desapareció`)
    await this.#audit('update', entity, id, before ?? null, after)
    return { id, version: versionOf(after) }
  }

  /** Borra con versión esperada y audita (`delete`, before = la fila borrada). Mismos 404/409 que update. */
  async delete<T extends VersionedTable>(entity: AuditedEntity<T>, id: string, expectedVersion: number): Promise<void> {
    const { table } = entity
    const before = await this.#row(entity, id, true)
    const result = await this.#tx.delete(table).where(and(eq(table.id, id), eq(table.version, expectedVersion)))
    if (result.rowCount !== 1 || before === undefined) throw this.#missOrConflict(entity, before)
    await this.#audit('delete', entity, id, before, null)
  }

  /**
   * Borra y audita una fila hija que no es un agregado (no tiene `version`): un permiso de la matriz
   * de un rol, una sucursal habilitada de un usuario. Su concurrencia la controla la versión del
   * agregado padre, que el comando actualiza con `update` en la misma transacción (BE-1a).
   */
  async removeChild<T extends TenantTable>(entity: AuditedEntity<T>, id: string): Promise<void> {
    const before = await this.#row(entity, id, true)
    if (before === undefined) throw new NotFoundError(entity.name)
    const result = await this.#tx.delete(entity.table).where(eq(entity.table.id, id))
    if (result.rowCount !== 1) throw new NotFoundError(entity.name)
    await this.#audit('delete', entity, id, before, null)
  }

  /**
   * Revoca los refresh tokens vigentes de un usuario en la transacción del comando (desactivarlo,
   * BE-1a). Los tokens son infraestructura de la sesión y no se auditan: el registro es el `update`
   * del usuario que lo desactiva.
   */
  revokeRefreshTokens(userId: string): Promise<void> {
    return revokeUserRefreshTokens(this.#tx, userId)
  }

  /** Próximo número de la serie, en esta transacción: `PED-000001` (ADR-BE-006 §Decisión 4). */
  nextNumber(series: DocumentSeries): Promise<string> {
    return nextNumber(this.#tx, this.actor.empresaId, series)
  }

  /** La fila completa por id, opcionalmente bloqueada (FOR UPDATE) para el before. */
  async #row<T extends TenantTable>(entity: AuditedEntity<T>, id: string, lock: boolean): Promise<RawRow | undefined> {
    const { table } = entity
    const query = lock
      ? sql`select * from ${table} where ${table.id} = ${id} for update`
      : sql`select * from ${table} where ${table.id} = ${id}`
    const result = await this.#tx.execute(query)
    return result.rows[0]
  }

  #missOrConflict<T extends TenantTable>(entity: AuditedEntity<T>, before: RawRow | undefined): Error {
    if (before === undefined) return new NotFoundError(entity.name)
    return new ConflictError('version-conflict', `${entity.name} cambió desde que se leyó`, {
      currentVersion: versionOf(before),
    })
  }

  async #audit<T extends TenantTable>(
    action: AuditAction,
    entity: AuditedEntity<T>,
    entityId: string,
    before: RawRow | null,
    after: RawRow | null,
  ): Promise<void> {
    const secrets = secretColumnNames(entity)
    await this.#tx.insert(auditLog).values({
      id: newId(),
      empresaId: this.actor.empresaId,
      userId: this.actor.userId,
      action,
      entity: entity.name,
      entityId,
      before: before === null ? null : snapshot(before, secrets),
      after: after === null ? null : snapshot(after, secrets),
      requestId: this.actor.requestId,
    })
  }
}

function versionOf(row: RawRow): number | null {
  const v = row.version
  return typeof v === 'number' ? v : null
}

/** Las columnas secretas se declaran por propiedad TS; la fila cruda viene con nombres de columna. */
function secretColumnNames<T extends TenantTable>(entity: AuditedEntity<T>): string[] {
  const columns = getTableColumns(entity.table)
  return entity.secretColumns.map(property => {
    const column: unknown = Object.getOwnPropertyDescriptor(columns, property)?.value
    if (!(column instanceof Column)) throw new Error(`${entity.name}: la columna secreta ${property} no existe`)
    return column.name
  })
}
