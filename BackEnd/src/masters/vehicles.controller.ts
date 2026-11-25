import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateVehicleRequest,
  createVehicleRequestSchema,
  idSchema,
  type UpdateVehicleRequest,
  updateVehicleRequestSchema,
  type Vehicle,
  type VehicleErrorCode,
  type VehicleListQuery,
  vehicleListQuerySchema,
  type VehiclePage,
  type VersionRequest,
  versionRequestSchema,
} from '@sdgpd/contracts'
import { and, count, eq, type SQL } from 'drizzle-orm'
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
import { containsAny, toVehicle, vehicleEntity } from './masters.queries.ts'

const PATENTE_DUPLICADA = new BusinessRuleError('patente-duplicada' satisfies VehicleErrorCode, 'Ya existe un vehículo con esa patente')

/** Columnas de la fila a partir de la capacidad del contrato. */
function capacityColumns(c: CreateVehicleRequest['capacidad']) {
  return { bultos: c.bultos, pesoKg: c.pesoKg, volumenM3: c.volumenM3, refrigerado: c.refrigerado, zonasHabilitadas: c.zonasHabilitadas }
}

/** Flota de vehículos (alcance EMPRESA; módulo `logistics` de la matriz). */
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly database: Database) {}

  /** `soloActivos` alimenta los selectores de viaje (ADR-016); no hay un endpoint aparte de "activos". */
  @Get()
  @RequirePermission('logistics', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(vehicleListQuerySchema)) query: VehicleListQuery): Promise<VehiclePage> {
    return this.database.read(actor.empresaId, async r => {
      const where: SQL | undefined = and(
        query.search === undefined ? undefined : containsAny(query.search, [vehicles.patente, vehicles.tipo]),
        query.soloActivos === true ? eq(vehicles.activo, true) : undefined,
      )
      const page = await offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(vehicles).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          r
            .select()
            .from(vehicles)
            .where(where)
            .orderBy(...orderByWhitelist({ patente: vehicles.patente, tipo: vehicles.tipo }, query.sortField, query.sortDirection, vehicles.id))
            .limit(limit)
            .offset(offset),
      })
      return { ...page, items: page.items.map(toVehicle) }
    })
  }

  @Get(':id')
  @RequirePermission('logistics', 'ver')
  async get(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<Vehicle> {
    const row = await this.database.read(actor.empresaId, async r => (await r.select().from(vehicles).where(eq(vehicles.id, id)))[0])
    if (row === undefined) throw new NotFoundError('vehicle')
    return toVehicle(row)
  }

  /** Alta (nace activo). Patente repetida (normalizada) en la empresa: 422 `patente-duplicada`. */
  @Post()
  @RequirePermission('logistics', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createVehicleRequestSchema)) body: CreateVehicleRequest): Promise<Vehicle> {
    const id = newId()
    try {
      await tx.insert(vehicleEntity, { id, empresaId: tx.actor.empresaId, patente: body.patente, tipo: body.tipo, ...capacityColumns(body.capacidad) })
    } catch (err) {
      if (isUniqueViolation(err, 'vehicles_patente_uk')) throw PATENTE_DUPLICADA
      throw err
    }
    return this.#read(tx, id)
  }

  @Put(':id')
  @RequirePermission('logistics', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateVehicleRequestSchema)) body: UpdateVehicleRequest,
  ): Promise<Vehicle> {
    try {
      await tx.update(vehicleEntity, id, body.version, { patente: body.patente, tipo: body.tipo, ...capacityColumns(body.capacidad) })
    } catch (err) {
      if (isUniqueViolation(err, 'vehicles_patente_uk')) throw PATENTE_DUPLICADA
      throw err
    }
    return this.#read(tx, id)
  }

  @Post(':id/activate')
  @RequirePermission('logistics', 'editar')
  activate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(versionRequestSchema)) body: VersionRequest): Promise<Vehicle> {
    return this.#setActivo(tx, id, body.version, true)
  }

  @Post(':id/deactivate')
  @RequirePermission('logistics', 'editar')
  deactivate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(versionRequestSchema)) body: VersionRequest): Promise<Vehicle> {
    return this.#setActivo(tx, id, body.version, false)
  }

  async #setActivo(tx: CommandTx, id: string, version: number, activo: boolean): Promise<Vehicle> {
    await tx.update(vehicleEntity, id, version, { activo })
    return this.#read(tx, id)
  }

  async #read(tx: CommandTx, id: string): Promise<Vehicle> {
    const row = (await tx.select().from(vehicles).where(eq(vehicles.id, id)))[0]
    if (row === undefined) throw new NotFoundError('vehicle')
    return toVehicle(row)
  }
}
