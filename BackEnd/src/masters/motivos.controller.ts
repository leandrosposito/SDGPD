import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import {
  type CreateMotivoRequest,
  createMotivoRequestSchema,
  idSchema,
  type MotivoCatalog,
  type MotivoCatalogQuery,
  motivoCatalogQuerySchema,
  type MotivoContract,
  type MotivoErrorCode,
  MOTIVOS_MAX,
  type UpdateMotivoRequest,
  updateMotivoRequestSchema,
} from '@sdgpd/contracts'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { newId } from '../db/ids.ts'
import { isUniqueViolation } from '../db/pg-errors.ts'
import { motivos } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { BusinessRuleError, NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { findMotivo, motivoEntity, selectMotivos } from './masters.queries.ts'

/** Scope del lock que serializa las altas de motivos de una empresa (el tope se cuenta). */
const MOTIVOS_LOCK = 'motivos'

async function motivoOrThrow(tx: CommandTx, id: string): Promise<MotivoContract> {
  const motivo = await findMotivo(tx.select, id)
  if (motivo === undefined) throw new NotFoundError('motivo')
  return motivo
}

/**
 * Catálogo de motivos (BE-2, ADR-010 §5). Módulo `logistics` de la matriz: lo consumen las entregas.
 * Tamaño fijo con tope documentado (MOTIVOS_MAX, ADR-BE-004 sub-decisión 6): el catálogo se lee
 * entero, sin paginar. El código y el tipo no se editan (las entregas guardan el código).
 */
@Controller('motivos')
export class MotivosController {
  constructor(private readonly database: Database) {}

  /** El catálogo, filtrable por tipo y estado. Orden: por tipo, "OTRO" al final, y por descripción. */
  @Get()
  @RequirePermission('logistics', 'ver')
  catalog(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(motivoCatalogQuerySchema)) query: MotivoCatalogQuery): Promise<MotivoCatalog> {
    return this.database.read(actor.empresaId, async r => {
      const where = and(
        query.tipo === undefined ? undefined : eq(motivos.tipo, query.tipo),
        query.activo === undefined ? undefined : eq(motivos.activo, query.activo),
      )
      const items = await selectMotivos(r.select, where)
        .orderBy(asc(motivos.tipo), sql`${motivos.codigo} = 'OTRO'`, asc(motivos.descripcion), asc(motivos.id))
        .limit(MOTIVOS_MAX)
      return { items }
    })
  }

  @Get(':id')
  @RequirePermission('logistics', 'ver')
  async detail(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<MotivoContract> {
    const motivo = await this.database.read(actor.empresaId, r => findMotivo(r.select, id))
    if (motivo === undefined) throw new NotFoundError('motivo')
    return motivo
  }

  /**
   * Alta. Nace activo. Mismo código y tipo en la empresa: 422 `motivo-duplicado`. Con el catálogo
   * lleno (MOTIVOS_MAX): 422 `motivos-limit-reached`; el lock serializa las altas para que dos
   * concurrentes no pasen juntas el conteo.
   */
  @Post()
  @RequirePermission('logistics', 'crear')
  async create(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createMotivoRequestSchema)) body: CreateMotivoRequest): Promise<MotivoContract> {
    await tx.lockScope(MOTIVOS_LOCK)
    const [total] = await tx.select({ n: count() }).from(motivos)
    if ((total?.n ?? 0) >= MOTIVOS_MAX) {
      throw new BusinessRuleError('motivos-limit-reached' satisfies MotivoErrorCode, `La empresa ya tiene ${MOTIVOS_MAX} motivos, el máximo del catálogo`)
    }
    const id = newId()
    try {
      await tx.insert(motivoEntity, { id, empresaId: tx.actor.empresaId, ...body })
    } catch (err) {
      if (isUniqueViolation(err, 'motivos_tipo_codigo_uk')) {
        throw new BusinessRuleError('motivo-duplicado' satisfies MotivoErrorCode, 'Ya existe un motivo con ese código para ese tipo')
      }
      throw err
    }
    return motivoOrThrow(tx, id)
  }

  /** Descripción y flags, con la versión leída (409 si cambió). */
  @Put(':id')
  @RequirePermission('logistics', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateMotivoRequestSchema)) body: UpdateMotivoRequest,
  ): Promise<MotivoContract> {
    const { version, ...changes } = body
    await tx.update(motivoEntity, id, version, changes)
    return motivoOrThrow(tx, id)
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermission('logistics', 'editar')
  activate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<MotivoContract> {
    return this.setActivo(tx, id, true)
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermission('logistics', 'editar')
  deactivate(@Command() tx: CommandTx, @Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<MotivoContract> {
    return this.setActivo(tx, id, false)
  }

  /** Transición de estado sin `version` (ADR-BE-005, sub-decisión 3); si ya está en ese estado, no escribe. */
  private async setActivo(tx: CommandTx, id: string, activo: boolean): Promise<MotivoContract> {
    const [row] = await tx.select({ activo: motivos.activo, version: motivos.version }).from(motivos).where(eq(motivos.id, id)).for('update')
    if (row === undefined) throw new NotFoundError('motivo')
    if (row.activo !== activo) await tx.update(motivoEntity, id, row.version, { activo })
    return motivoOrThrow(tx, id)
  }
}
