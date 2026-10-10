import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateVehicleRequest,
  createVehicleRequestSchema,
  idSchema,
  normalizePatente,
  type UpdateVehicleRequest,
  updateVehicleRequestSchema,
  type VehicleCapacityContract,
  type VehicleContract,
  type VehicleErrorCode,
  type VehicleListQuery,
  vehicleListQuerySchema,
  type VehiclePage,
  type VehicleSearchQuery,
  vehicleSearchQuerySchema,
  type VehicleSearchResult,
} from '@sdgpd/contracts'
import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { newId } from '../db/ids.ts'
import { offsetPage, orderByWhitelist } from '../db/pagination.ts'
import { isUniqueViolation } from '../db/pg-errors.ts'
import { vehicles } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { BusinessRuleError, NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { bounded, containsPattern, findVehicle, selectVehicles, toVehicle, vehicleEntity } from './masters.queries.ts'

/** Texto libre: patente (también normalizada) o tipo. */
function searchCondition(text: string | undefined): SQL | undefined {
  if (text === undefined || text === '') return undefined
  return or(
    ilike(vehicles.patente, containsPattern(normalizePatente(text))),
    ilike(vehicles.patente, containsPattern(text)),
    ilike(vehicles.tipo, containsPattern(text)),
  )
}

function capacityColumns(c: VehicleCapacityContract) {
  return {
    capacidadBultos: c.bultos,
    capacidadPesoKg: c.pesoKg,
    capacidadVolumenM3: c.volumenM3,
    capacidadRefrigerado: c.refrigerado,
    capacidadZonasHabilitadas: c.zonasHabilitadas,
  }
}

/** La patente ya la tiene otro vehículo de la empresa: 422 `patente-duplicada` (la garantiza el índice). */
async function withPatenteCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (err) {
    if (isUniqueViolation(err, 'vehicles_patente_uk')) {
      throw new BusinessRuleError('patente-duplicada' satisfies VehicleErrorCode, 'Ya existe un vehículo con esa patente')
    }
    throw err
  }
}

async function vehicleOrThrow(tx: CommandTx, id: string): Promise<VehicleContract> {
  const vehicle = await findVehicle(tx.select, id)
  if (vehicle === undefined) throw new NotFoundError('vehicle')
  return vehicle
}

/**
 * Vehículos (BE-2). Módulo `logistics` de la matriz: la flota la administra y la usa logística
 * (ADR-011). Alcance EMPRESA, sin sucursal (ADR-BE-002).
 */
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('logistics', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(vehicleListQuerySchema)) query: VehicleListQuery): Promise<VehiclePage> {
    return this.database.read(actor.empresaId, async r => {
      const where = and(searchCondition(query.search), query.activo === undefined ? undefined : eq(vehicles.activo, query.activo))
      const page = await offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(vehicles).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          selectVehicles(r.select, where)
            .orderBy(...orderByWhitelist({ patente: vehicles.patente, tipo: vehicles.tipo }, query.sortField, query.sortDirection, vehicles.id))
            .limit(limit)
            .offset(offset),
      })
      return { ...page, items: page.items.map(toVehicle) }
    })
  }

  /** Búsqueda acotada para selectores (ADR-016): hasta `limit`, con `truncated`. */
  @Get('search')
  @RequirePermission('logistics', 'ver')
  search(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(vehicleSearchQuerySchema)) query: VehicleSearchQuery): Promise<VehicleSearchResult> {
    return this.database.read(actor.empresaId, async r => {
      const where = and(searchCondition(query.q), query.activo === undefined ? undefined : eq(vehicles.activo, query.activo))
      const result = await bounded(query.limit, limit =>
        selectVehicles(r.select, where).orderBy(asc(vehicles.patente), asc(vehicles.id)).limit(limit),
      )
      return { items: result.items.map(toVehicle), truncated: result.truncated }
    })
  }

  @Get(':id')
  @RequirePermission('logistics', 'ver')
  async detail(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<VehicleContract> {
    const vehicle = await this.database.read(actor.empresaId, r => findVehicle(r.select, id))
    if (vehicle === undefined) throw new NotFoundError('vehicle')
    return vehicle
  }

  /** Alta. Nace activo. Patente repetida en la empresa (normalizada): 422 `patente-duplicada`. */
  @Post()
  @RequirePermission('logistics', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createVehicleRequestSchema)) body: CreateVehicleRequest): Promise<VehicleContract> {
    const id = newId()
    await withPatenteCheck(() =>
      tx.insert(vehicleEntity, { id, empresaId: tx.actor.empresaId, patente: body.patente, tipo: body.tipo, ...capacityColumns(body.capacidad) }),
    )
    return vehicleOrThrow(tx, id)
  }

  /** Edición con la versión leída (409 si cambió). */
  @Put(':id')
  @RequirePermission('logistics', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateVehicleRequestSchema)) body: UpdateVehicleRequest,
  ): Promise<VehicleContract> {
    await withPatenteCheck(() =>
      tx.update(vehicleEntity, id, body.version, { patente: body.patente, tipo: body.tipo, ...capacityColumns(body.capacidad) }),
    )
    return vehicleOrThrow(tx, id)
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermission('logistics', 'editar')
  activate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<VehicleContract> {
    return this.setActivo(tx, id, true)
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermission('logistics', 'editar')
  deactivate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<VehicleContract> {
    return this.setActivo(tx, id, false)
  }

  /** Transición de estado sin `version` (ADR-BE-005, sub-decisión 3); si ya está en ese estado, no escribe. */
  private async setActivo(tx: CommandTx, id: string, activo: boolean): Promise<VehicleContract> {
    const [row] = await tx.select({ activo: vehicles.activo, version: vehicles.version }).from(vehicles).where(eq(vehicles.id, id)).for('update')
    if (row === undefined) throw new NotFoundError('vehicle')
    if (row.activo !== activo) await tx.update(vehicleEntity, id, row.version, { activo })
    return vehicleOrThrow(tx, id)
  }
}
