import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateDriverRequest,
  createDriverRequestSchema,
  type DriverContract,
  type DriverErrorCode,
  type DriverListQuery,
  driverListQuerySchema,
  type DriverPage,
  type DriverSearchQuery,
  driverSearchQuerySchema,
  type DriverSearchResult,
  idSchema,
  normalizeLicencia,
  type UpdateDriverRequest,
  updateDriverRequestSchema,
} from '@sdgpd/contracts'
import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { newId } from '../db/ids.ts'
import { offsetPage, orderByWhitelist } from '../db/pagination.ts'
import { isUniqueViolation } from '../db/pg-errors.ts'
import { drivers, users } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { BusinessRuleError, NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { bounded, containsPattern, driverEntity, findDriver, selectDrivers } from './masters.queries.ts'

/** Texto libre: nombre o licencia (como se escribió, o normalizada). */
function searchCondition(text: string | undefined): SQL | undefined {
  if (text === undefined || text === '') return undefined
  const normalized = normalizeLicencia(text)
  return or(
    ilike(drivers.nombre, containsPattern(text)),
    ilike(drivers.licencia, containsPattern(text)),
    normalized === '' ? undefined : ilike(drivers.licenciaNormalized, containsPattern(normalized)),
  )
}

/** Licencia o usuario repetidos en la empresa: 422 con su código (los garantizan los índices). */
async function withUniqueChecks<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (err) {
    if (isUniqueViolation(err, 'drivers_licencia_uk')) {
      throw new BusinessRuleError('licencia-duplicada' satisfies DriverErrorCode, 'Ya existe un chofer con esa licencia')
    }
    if (isUniqueViolation(err, 'drivers_usuario_uk')) {
      throw new BusinessRuleError('user-already-linked' satisfies DriverErrorCode, 'Ese usuario ya está vinculado a otro chofer')
    }
    throw err
  }
}

/** El usuario a vincular tiene que ser de la empresa (la FK compuesta lo garantiza; esto da un 422 con código). */
async function assertUser(tx: CommandTx, usuarioId: string | null | undefined): Promise<void> {
  if (usuarioId === null || usuarioId === undefined) return
  const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, usuarioId))
  if (user === undefined) throw new BusinessRuleError('user-not-found' satisfies DriverErrorCode, 'El usuario no existe')
}

async function driverOrThrow(tx: CommandTx, id: string): Promise<DriverContract> {
  const driver = await findDriver(tx.select, id)
  if (driver === undefined) throw new NotFoundError('driver')
  return driver
}

/**
 * Choferes (BE-2). Módulo `logistics` de la matriz, como los vehículos. Alcance EMPRESA, sin
 * sucursal (ADR-BE-002). La licencia es única por empresa (hallazgo M10).
 */
@Controller('drivers')
export class DriversController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('logistics', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(driverListQuerySchema)) query: DriverListQuery): Promise<DriverPage> {
    return this.database.read(actor.empresaId, async r => {
      const where = and(searchCondition(query.search), query.activo === undefined ? undefined : eq(drivers.activo, query.activo))
      return offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(drivers).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          selectDrivers(r.select, where)
            .orderBy(
              ...orderByWhitelist({ nombre: drivers.nombre, licencia: drivers.licenciaNormalized }, query.sortField, query.sortDirection, drivers.id),
            )
            .limit(limit)
            .offset(offset),
      })
    })
  }

  /** Búsqueda acotada para selectores (ADR-016): hasta `limit`, con `truncated`. */
  @Get('search')
  @RequirePermission('logistics', 'ver')
  search(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(driverSearchQuerySchema)) query: DriverSearchQuery): Promise<DriverSearchResult> {
    return this.database.read(actor.empresaId, r => {
      const where = and(searchCondition(query.q), query.activo === undefined ? undefined : eq(drivers.activo, query.activo))
      return bounded(query.limit, limit => selectDrivers(r.select, where).orderBy(asc(drivers.nombre), asc(drivers.id)).limit(limit))
    })
  }

  @Get(':id')
  @RequirePermission('logistics', 'ver')
  async detail(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<DriverContract> {
    const driver = await this.database.read(actor.empresaId, r => findDriver(r.select, id))
    if (driver === undefined) throw new NotFoundError('driver')
    return driver
  }

  /** Alta. Nace activo. Licencia repetida en la empresa (normalizada): 422 `licencia-duplicada`. */
  @Post()
  @RequirePermission('logistics', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createDriverRequestSchema)) body: CreateDriverRequest): Promise<DriverContract> {
    await assertUser(tx, body.usuarioId)
    const id = newId()
    await withUniqueChecks(() =>
      tx.insert(driverEntity, {
        id,
        empresaId: tx.actor.empresaId,
        nombre: body.nombre,
        licencia: body.licencia,
        telefono: body.telefono,
        usuarioId: body.usuarioId ?? null,
      }),
    )
    return driverOrThrow(tx, id)
  }

  /** Edición con la versión leída (409 si cambió). `usuarioId` ausente deja el vínculo como está. */
  @Put(':id')
  @RequirePermission('logistics', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateDriverRequestSchema)) body: UpdateDriverRequest,
  ): Promise<DriverContract> {
    await assertUser(tx, body.usuarioId)
    const changes = { nombre: body.nombre, licencia: body.licencia, telefono: body.telefono }
    await withUniqueChecks(() =>
      tx.update(driverEntity, id, body.version, body.usuarioId === undefined ? changes : { ...changes, usuarioId: body.usuarioId }),
    )
    return driverOrThrow(tx, id)
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermission('logistics', 'editar')
  activate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<DriverContract> {
    return this.setActivo(tx, id, true)
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermission('logistics', 'editar')
  deactivate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<DriverContract> {
    return this.setActivo(tx, id, false)
  }

  /** Transición de estado sin `version` (ADR-BE-005, sub-decisión 3); si ya está en ese estado, no escribe. */
  private async setActivo(tx: CommandTx, id: string, activo: boolean): Promise<DriverContract> {
    const [row] = await tx.select({ activo: drivers.activo, version: drivers.version }).from(drivers).where(eq(drivers.id, id)).for('update')
    if (row === undefined) throw new NotFoundError('driver')
    if (row.activo !== activo) await tx.update(driverEntity, id, row.version, { activo })
    return driverOrThrow(tx, id)
  }
}
