import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateDriverRequest,
  createDriverRequestSchema,
  type Driver,
  type DriverListQuery,
  driverListQuerySchema,
  type DriverPage,
  idSchema,
  type UpdateDriverRequest,
  updateDriverRequestSchema,
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
import { drivers } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { containsAny, driverEntity, toDriver } from './masters.queries.ts'

/** Choferes (alcance EMPRESA; módulo `logistics` de la matriz). */
@Controller('drivers')
export class DriversController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('logistics', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(driverListQuerySchema)) query: DriverListQuery): Promise<DriverPage> {
    return this.database.read(actor.empresaId, async r => {
      const where: SQL | undefined = and(
        query.search === undefined ? undefined : containsAny(query.search, [drivers.nombre, drivers.licencia]),
        query.soloActivos === true ? eq(drivers.activo, true) : undefined,
      )
      const page = await offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(drivers).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          r
            .select()
            .from(drivers)
            .where(where)
            .orderBy(...orderByWhitelist({ nombre: drivers.nombre, licencia: drivers.licencia }, query.sortField, query.sortDirection, drivers.id))
            .limit(limit)
            .offset(offset),
      })
      return { ...page, items: page.items.map(toDriver) }
    })
  }

  @Get(':id')
  @RequirePermission('logistics', 'ver')
  async get(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<Driver> {
    const row = await this.database.read(actor.empresaId, async r => (await r.select().from(drivers).where(eq(drivers.id, id)))[0])
    if (row === undefined) throw new NotFoundError('driver')
    return toDriver(row)
  }

  @Post()
  @RequirePermission('logistics', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createDriverRequestSchema)) body: CreateDriverRequest): Promise<Driver> {
    const id = newId()
    await tx.insert(driverEntity, { id, empresaId: tx.actor.empresaId, ...body })
    return this.#read(tx, id)
  }

  @Put(':id')
  @RequirePermission('logistics', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateDriverRequestSchema)) body: UpdateDriverRequest,
  ): Promise<Driver> {
    const { version, ...changes } = body
    await tx.update(driverEntity, id, version, changes)
    return this.#read(tx, id)
  }

  @Post(':id/activate')
  @RequirePermission('logistics', 'editar')
  activate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(versionRequestSchema)) body: VersionRequest): Promise<Driver> {
    return this.#setActivo(tx, id, body.version, true)
  }

  @Post(':id/deactivate')
  @RequirePermission('logistics', 'editar')
  deactivate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(versionRequestSchema)) body: VersionRequest): Promise<Driver> {
    return this.#setActivo(tx, id, body.version, false)
  }

  async #setActivo(tx: CommandTx, id: string, version: number, activo: boolean): Promise<Driver> {
    await tx.update(driverEntity, id, version, { activo })
    return this.#read(tx, id)
  }

  async #read(tx: CommandTx, id: string): Promise<Driver> {
    const row = (await tx.select().from(drivers).where(eq(drivers.id, id)))[0]
    if (row === undefined) throw new NotFoundError('driver')
    return toDriver(row)
  }
}
