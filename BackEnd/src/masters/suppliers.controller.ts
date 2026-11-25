import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateSupplierRequest,
  createSupplierRequestSchema,
  idSchema,
  type Supplier,
  type SupplierErrorCode,
  type SupplierListQuery,
  supplierListQuerySchema,
  type SupplierPage,
  type UpdateSupplierRequest,
  updateSupplierRequestSchema,
} from '@sdgpd/contracts'
import { and, count, eq, type SQL } from 'drizzle-orm'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { newId } from '../db/ids.ts'
import { offsetPage, orderByWhitelist } from '../db/pagination.ts'
import { isUniqueViolation } from '../db/pg-errors.ts'
import { suppliers } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { BusinessRuleError, NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { containsAny, cuitDigits, supplierEntity, toSupplier } from './masters.queries.ts'

const CUIT_DUPLICADO = new BusinessRuleError('cuit-duplicado' satisfies SupplierErrorCode, 'Ya existe un proveedor con ese CUIT')

/** Proveedores (maestro de la empresa; módulo `suppliers` de la matriz). Sin saldo ni productos: llegan en BE-8 y BE-9. */
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('suppliers', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(supplierListQuerySchema)) query: SupplierListQuery): Promise<SupplierPage> {
    return this.database.read(actor.empresaId, async r => {
      const where: SQL | undefined = and(
        query.search === undefined ? undefined : containsAny(query.search, [suppliers.name, suppliers.cuit]),
        query.category === undefined ? undefined : eq(suppliers.category, query.category),
      )
      const page = await offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(suppliers).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          r
            .select()
            .from(suppliers)
            .where(where)
            .orderBy(...orderByWhitelist({ name: suppliers.name, cuit: suppliers.cuit, category: suppliers.category }, query.sortField, query.sortDirection, suppliers.id))
            .limit(limit)
            .offset(offset),
      })
      return { ...page, items: page.items.map(toSupplier) }
    })
  }

  @Get(':id')
  @RequirePermission('suppliers', 'ver')
  async get(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<Supplier> {
    const row = await this.database.read(actor.empresaId, async r => (await r.select().from(suppliers).where(eq(suppliers.id, id)))[0])
    if (row === undefined) throw new NotFoundError('supplier')
    return toSupplier(row)
  }

  /** Alta. El CUIT es único por empresa comparado sin guiones: repetido, 422 `cuit-duplicado`. */
  @Post()
  @RequirePermission('suppliers', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createSupplierRequestSchema)) body: CreateSupplierRequest): Promise<Supplier> {
    const id = newId()
    try {
      await tx.insert(supplierEntity, { id, empresaId: tx.actor.empresaId, ...body, cuitDigits: cuitDigits(body.cuit) })
    } catch (err) {
      if (isUniqueViolation(err, 'suppliers_cuit_uk')) throw CUIT_DUPLICADO
      throw err
    }
    return this.#read(tx, id)
  }

  /** Edición parcial con la versión leída (409 `version-conflict` si cambió). */
  @Put(':id')
  @RequirePermission('suppliers', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateSupplierRequestSchema)) body: UpdateSupplierRequest,
  ): Promise<Supplier> {
    const { version, ...changes } = body
    try {
      await tx.update(supplierEntity, id, version, { ...changes, ...(changes.cuit === undefined ? {} : { cuitDigits: cuitDigits(changes.cuit) }) })
    } catch (err) {
      if (isUniqueViolation(err, 'suppliers_cuit_uk')) throw CUIT_DUPLICADO
      throw err
    }
    return this.#read(tx, id)
  }

  async #read(tx: CommandTx, id: string): Promise<Supplier> {
    const row = (await tx.select().from(suppliers).where(eq(suppliers.id, id)))[0]
    if (row === undefined) throw new NotFoundError('supplier')
    return toSupplier(row)
  }
}
