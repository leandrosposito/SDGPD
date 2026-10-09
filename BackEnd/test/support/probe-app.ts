// App de prueba de BE-0b: AppModule completo + un guard y controllers que SOLO existen en test/.
// El guard reemplaza al AuthGuard real (overrideProvider) y fija el actor desde headers de prueba
// (x-test-empresa, x-test-user): en src/ no existe ninguna forma de hacerlo (lo fija la autenticación
// de BE-1a, con bindActor). Desde BE-1a toda ruta declara su política (la verificación de arranque
// corre también acá): las de prueba exigen settings.editar, que este guard no mira, y /auth/probe se
// agrega a las rutas públicas solo en esta app.
import 'reflect-metadata'
import type { Server } from 'node:http'
import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  HttpCode,
  type INestApplication,
  Injectable,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { cursorListQuerySchema, offsetListQuerySchema } from '@sdgpd/contracts'
import { and, count, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { AppModule } from '../../src/app.module.ts'
import { AuthGuard } from '../../src/auth/auth.guard.ts'
import { DEFAULT_ROUTE_ALLOWLIST, Public, RequirePermission, ROUTE_ALLOWLIST } from '../../src/auth/route-policy.ts'
import { type Actor, bindActor, CurrentActor } from '../../src/context/actor.ts'
import { auditedEntity, type CommandTx } from '../../src/db/command.ts'
import { Database } from '../../src/db/database.ts'
import { newId } from '../../src/db/ids.ts'
import { cursorPage, keysetAfter, keysetOrder, offsetPage, orderByWhitelist } from '../../src/db/pagination.ts'
import { auditLog, branches, DOCUMENT_SERIES } from '../../src/db/schema/index.ts'
import { Command } from '../../src/http/command.interceptor.ts'
import { BusinessRuleError } from '../../src/http/errors.ts'
import { ListQueryPipe } from '../../src/http/list-query.pipe.ts'
import { ZodValidationPipe } from '../../src/http/zod-validation.pipe.ts'
import { testConfig } from './db.ts'

export const TEST_EMPRESA_HEADER = 'x-test-empresa'
export const TEST_USER_HEADER = 'x-test-user'

@Injectable()
class TestActorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>()
    const empresaId = request.headers[TEST_EMPRESA_HEADER]
    const userId = request.headers[TEST_USER_HEADER]
    if (typeof empresaId === 'string' && typeof userId === 'string') bindActor(request, { empresaId, userId })
    return true
  }
}

export const branchEntity = auditedEntity(branches, 'branch')

const createBranchSchema = z.object({ name: z.string().min(1), code: z.string().min(1) }).strict()
const updateBranchSchema = z.object({ name: z.string().min(1), version: z.int().min(1) }).strict()
const numberSchema = z.object({ series: z.enum(DOCUMENT_SERIES) }).strict()

export const branchListQuery = offsetListQuerySchema({
  sortFields: ['name', 'code', 'createdAt'],
  defaultSort: 'code',
  filters: { status: z.enum(['active', 'inactive']) },
})
export const auditListQuery = cursorListQuerySchema({
  sortFields: ['at'],
  defaultSort: 'at',
  filters: { entity: z.string().min(1) },
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function insertBranch(tx: CommandTx, body: z.infer<typeof createBranchSchema>) {
  return tx.insert(branchEntity, {
    id: newId(),
    empresaId: tx.actor.empresaId,
    name: body.name,
    code: body.code,
    city: 'Córdoba',
    address: 'Calle 1',
  })
}

@Controller('probe')
@RequirePermission('settings', 'editar')
class ProbeController {
  constructor(private readonly database: Database) {}

  @Post('branches')
  createBranch(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createBranchSchema)) body: z.infer<typeof createBranchSchema>) {
    return insertBranch(tx, body)
  }

  @Post('branches-200')
  @HttpCode(200)
  createBranch200(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createBranchSchema)) body: z.infer<typeof createBranchSchema>) {
    return insertBranch(tx, body)
  }

  @Post('slow-branches')
  async slowBranch(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createBranchSchema)) body: z.infer<typeof createBranchSchema>) {
    const result = await insertBranch(tx, body)
    await sleep(1500)
    return result
  }

  @Post('failing')
  async failing(@Command() tx: CommandTx, @Body(new ZodValidationPipe(createBranchSchema)) body: z.infer<typeof createBranchSchema>) {
    await insertBranch(tx, body)
    await tx.nextNumber('PED')
    throw new BusinessRuleError('probe-failure', 'falla a propósito, después de escribir')
  }

  @Put('branches/:id')
  updateBranch(
    @Command() tx: CommandTx,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: z.infer<typeof updateBranchSchema>,
  ) {
    return tx.update(branchEntity, id, body.version, { name: body.name })
  }

  @Post('numbers')
  async number(@Command() tx: CommandTx, @Body(new ZodValidationPipe(numberSchema)) body: z.infer<typeof numberSchema>) {
    return { number: await tx.nextNumber(body.series) }
  }

  @Get('branches')
  listBranches(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(branchListQuery)) query: z.infer<typeof branchListQuery>) {
    return this.database.read(actor.empresaId, r => {
      const where: SQL | undefined = and(
        eq(branches.empresaId, actor.empresaId),
        query.status === undefined ? undefined : eq(branches.status, query.status),
      )
      return offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(branches).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          r
            .select({ id: branches.id, code: branches.code, name: branches.name, version: branches.version })
            .from(branches)
            .where(where)
            .orderBy(
              ...orderByWhitelist(
                { name: branches.name, code: branches.code, createdAt: branches.createdAt },
                query.sortField,
                query.sortDirection,
                branches.id,
              ),
            )
            .limit(limit)
            .offset(offset),
      })
    })
  }

  @Get('audit')
  listAudit(@CurrentActor() actor: Actor, @Query(new ListQueryPipe(auditListQuery)) query: z.infer<typeof auditListQuery>) {
    return this.database.read(actor.empresaId, r =>
      cursorPage({
        cursor: query.cursor,
        limit: query.limit,
        fetch: (after, limit) =>
          r
            .select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, entity: auditLog.entity, entityId: auditLog.entityId })
            .from(auditLog)
            .where(
              and(
                query.entity === undefined ? undefined : eq(auditLog.entity, query.entity),
                keysetAfter(auditLog.at, auditLog.id, after, query.sortDirection),
              ),
            )
            .orderBy(...keysetOrder(auditLog.at, auditLog.id, query.sortDirection))
            .limit(limit),
        keyOf: row => ({ at: row.at, id: row.id }),
      }),
    )
  }
}

/** Una ruta bajo /auth: exenta de Idempotency-Key y de la transacción de comando. */
@Controller('auth')
class AuthProbeController {
  @Post('probe')
  @HttpCode(200)
  @Public()
  probe() {
    return { ok: true }
  }
}

export type ProbeApp = { app: INestApplication<Server>; database: Database }

export async function createProbeApp(maxConnections = 2): Promise<ProbeApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(testConfig(maxConnections))],
    controllers: [ProbeController, AuthProbeController],
  })
    .overrideProvider(AuthGuard)
    .useClass(TestActorGuard)
    .overrideProvider(ROUTE_ALLOWLIST)
    .useValue({ ...DEFAULT_ROUTE_ALLOWLIST, public: [...DEFAULT_ROUTE_ALLOWLIST.public, 'POST /auth/probe'] })
    .compile()
  const app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false })
  await app.init()
  return { app, database: app.get(Database) }
}

/** Headers de actor de prueba. */
export function actorHeaders(empresaId: string, userId: string): Record<string, string> {
  return { [TEST_EMPRESA_HEADER]: empresaId, [TEST_USER_HEADER]: userId }
}
