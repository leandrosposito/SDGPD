import { Controller, Get, Query } from '@nestjs/common'
import { type BranchListQuery, branchListQuerySchema, type BranchPage } from '@sdgpd/contracts'
import { and, count, eq, inArray, type SQL } from 'drizzle-orm'
import { CurrentPrincipal } from '../auth/auth.guard.ts'
import { SessionOnly } from '../auth/route-policy.ts'
import { type Principal, permissionKey } from '../db/auth-store.ts'
import { Database } from '../db/database.ts'
import { offsetPage, orderByWhitelist } from '../db/pagination.ts'
import { branches } from '../db/schema/index.ts'
import { ListQueryPipe } from '../http/list-query.pipe.ts'
import { branchColumns } from './identity.queries.ts'

/**
 * GET /branches (BE-1a): con `settings.ver`, todas las sucursales de la empresa (para asignarlas a
 * usuarios); sin ese permiso, solo las habilitadas para el usuario.
 */
@Controller('branches')
export class BranchesController {
  constructor(private readonly database: Database) {}

  @Get()
  @SessionOnly()
  list(@CurrentPrincipal() principal: Principal, @Query(new ListQueryPipe(branchListQuerySchema)) query: BranchListQuery): Promise<BranchPage> {
    const all = principal.permissions.has(permissionKey('settings', 'ver'))
    const enabled = [...principal.branchIds]
    return this.database.read(principal.empresaId, r => {
      if (!all && enabled.length === 0) return Promise.resolve({ items: [], total: 0, page: query.page, pageSize: query.pageSize })
      const where: SQL | undefined = and(
        all ? undefined : inArray(branches.id, enabled),
        query.status === undefined ? undefined : eq(branches.status, query.status),
      )
      return offsetPage({
        page: query.page,
        pageSize: query.pageSize,
        count: async () => (await r.select({ n: count() }).from(branches).where(where))[0]?.n ?? 0,
        fetch: (limit, offset) =>
          r
            .select(branchColumns)
            .from(branches)
            .where(where)
            .orderBy(...orderByWhitelist({ code: branches.code, name: branches.name }, query.sortField, query.sortDirection, branches.id))
            .limit(limit)
            .offset(offset),
      })
    })
  }
}
