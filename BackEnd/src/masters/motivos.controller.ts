import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common'
import {
  idSchema,
  type Motivo,
  type MotivoList,
  type MotivoListQuery,
  motivoListQuerySchema,
  type UpdateMotivoRequest,
  updateMotivoRequestSchema,
} from '@sdgpd/contracts'
import { and, asc, eq, type SQL } from 'drizzle-orm'
import { RequirePermission } from '../auth/route-policy.ts'
import { type Actor, CurrentActor } from '../context/actor.ts'
import type { CommandTx } from '../db/command.ts'
import { Database } from '../db/database.ts'
import { motivos } from '../db/schema/index.ts'
import { Command } from '../http/command.interceptor.ts'
import { NotFoundError } from '../http/errors.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { motivoEntity, toMotivo } from './masters.queries.ts'

/**
 * Catálogo de motivos de la empresa (rechazo, reprogramación, no-entrega). Es un catálogo de tamaño
 * fijo: se devuelve entero, sin paginar (ADR-BE-004, sub-decisión 6). Los motivos iniciales los
 * siembra la empresa al crearse (hoy, `db:seed-dev`); el `codigo` y el `tipo` no se editan.
 */
@Controller('motivos')
export class MotivosController {
  constructor(private readonly database: Database) {}

  /** Lo consume logística (`logistics.ver`). Por defecto, solo los activos: lo que muestran los selectores. */
  @Get()
  @RequirePermission('logistics', 'ver')
  list(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(motivoListQuerySchema)) query: MotivoListQuery): Promise<MotivoList> {
    return this.database.read(actor.empresaId, async r => {
      const where: SQL | undefined = and(query.tipo === undefined ? undefined : eq(motivos.tipo, query.tipo), query.soloActivos ? eq(motivos.activo, true) : undefined)
      const rows = await r.select().from(motivos).where(where).orderBy(asc(motivos.tipo), asc(motivos.codigo))
      return { items: rows.map(toMotivo) }
    })
  }

  /** Edita la descripción, el activo y las dos banderas de comportamiento, con la versión leída. */
  @Put(':id')
  @RequirePermission('settings', 'editar')
  async update(
    @Command() tx: CommandTx,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateMotivoRequestSchema)) body: UpdateMotivoRequest,
  ): Promise<Motivo> {
    const { version, ...changes } = body
    await tx.update(motivoEntity, id, version, changes)
    const row = (await tx.select().from(motivos).where(eq(motivos.id, id)))[0]
    if (row === undefined) throw new NotFoundError('motivo')
    return toMotivo(row)
  }
}
