import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateSupplierRequest,
  createSupplierRequestSchema,
  idSchema,
  normalizeCuit,
  type SupplierContract,
  type SupplierErrorCode,
  type SupplierListQuery,
  supplierListQuerySchema,
  type SupplierPage,
  type SupplierSearchQuery,
  supplierSearchQuerySchema,
  type SupplierSearchResult,
  type UpdateSupplierRequest,
  updateSupplierRequestSchema,
} from '@sdgpd/contracts'
import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm'
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
import { bounded, containsPattern, findSupplier, selectSuppliers, supplierEntity } from './masters.queries.ts'

/** Texto libre: razón social o CUIT (como se escribió, o solo sus dígitos). */
function searchCondition(text: string | undefined): SQL | undefined {
  if (text === undefined || text === '') return undefined
  const digits = normalizeCuit(text)
  return or(
    ilike(suppliers.name, containsPattern(text)),
    ilike(suppliers.cuit, containsPattern(text)),
    /^\d+$/.test(digits) ? ilike(suppliers.cuitNormalized, containsPattern(digits)) : undefined,
  )
}

/** El CUIT ya lo tiene otro proveedor de la empresa: 422 `cuit-duplicado` (la unicidad la garantiza el índice). */
async function withCuitCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (err) {
    if (isUniqueViolation(err, 'suppliers_cuit_uk')) {
      throw new BusinessRuleError('cuit-duplicado' satisfies SupplierErrorCode, 'Ya existe un proveedor con ese CUIT')
    }
    throw err
  }
}

async function supplierOrThrow(tx: CommandTx, id: string): Promise<SupplierContract> {
  const supplier = await findSupplier(tx.select, id)
  if (supplier === undefined) throw new NotFoundError('supplier')
  return supplier
}

/** Proveedores (BE-2), módulo `suppliers` de la matriz. Alcance EMPRESA. */
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly database: Database) {}

  @Get()
  @RequirePermission('suppliers', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(supplierListQuerySchema)) query: SupplierListQuery): Promise<SupplierPage> {
    return this.database.read(actor.empresaId, async r => {
      const where = and(
        searchCondition(query.search),
        query.category === undefined || query.category === '' ? undefined : eq(suppliers.category, query.category),
        query.active === undefined ? undefined : eq(suppliers.active, query.active),
      )
      return offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(suppliers).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          selectSuppliers(r.select, where)
            .orderBy(
              ...orderByWhitelist(
                { name: suppliers.name, cuit: suppliers.cuitNormalized, category: suppliers.category },
                query.sortField,
                query.sortDirection,
                suppliers.id,
              ),
            )
            .limit(limit)
            .offset(offset),
      })
    })
  }

  /** Búsqueda acotada para selectores (ADR-016): hasta `limit`, con `truncated`. */
  @Get('search')
  @RequirePermission('suppliers', 'ver')
  search(
    @CurrentActor() actor: Actor,
    @Query(new ListQueryPipe(supplierSearchQuerySchema)) query: SupplierSearchQuery,
  ): Promise<SupplierSearchResult> {
    return this.database.read(actor.empresaId, r => {
      const where = and(searchCondition(query.q), query.active === undefined ? undefined : eq(suppliers.active, query.active))
      return bounded(query.limit, limit => selectSuppliers(r.select, where).orderBy(asc(suppliers.name), asc(suppliers.id)).limit(limit))
    })
  }

  @Get(':id')
  @RequirePermission('suppliers', 'ver')
  async detail(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<SupplierContract> {
    const supplier = await this.database.read(actor.empresaId, r => findSupplier(r.select, id))
    if (supplier === undefined) throw new NotFoundError('supplier')
    return supplier
  }

  /** Alta. Nace activo. CUIT repetido en la empresa (normalizado): 422 `cuit-duplicado`. */
  @Post()
  @RequirePermission('suppliers', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createSupplierRequestSchema)) body: CreateSupplierRequest): Promise<SupplierContract> {
    const id = newId()
    await withCuitCheck(() => tx.insert(supplierEntity, { id, empresaId: tx.actor.empresaId, ...body }))
    return supplierOrThrow(tx, id)
  }

  /** Edición de los campos del formulario, con la versión leída (409 si cambió). */
  @Put(':id')
  @RequirePermission('suppliers', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateSupplierRequestSchema)) body: UpdateSupplierRequest,
  ): Promise<SupplierContract> {
    const { version, ...changes } = body
    await withCuitCheck(() => tx.update(supplierEntity, id, version, changes))
    return supplierOrThrow(tx, id)
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermission('suppliers', 'editar')
  activate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<SupplierContract> {
    return this.setActive(tx, id, true)
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermission('suppliers', 'editar')
  deactivate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<SupplierContract> {
    return this.setActive(tx, id, false)
  }

  /**
   * Transición de estado (ADR-BE-004, sub-decisión 2): sin `version` (ADR-BE-005, sub-decisión 3). Si
   * ya está en ese estado no escribe nada; si no, bloquea la fila y la actualiza con su versión actual.
   */
  private async setActive(tx: CommandTx, id: string, active: boolean): Promise<SupplierContract> {
    const [row] = await tx.select({ active: suppliers.active, version: suppliers.version }).from(suppliers).where(eq(suppliers.id, id)).for('update')
    if (row === undefined) throw new NotFoundError('supplier')
    if (row.active !== active) await tx.update(supplierEntity, id, row.version, { active })
    return supplierOrThrow(tx, id)
  }
}
