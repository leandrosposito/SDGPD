import type { ClientAccount } from '@/shared/types/client.types'
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types'
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types'
import { httpClient } from '@/shared/api/httpClient'
import type { ClientAccountsQueryFilters, ClientAccountsSortField } from './clients.types'
import { listClients } from './clients.store'
import { matchesSearch } from './clients.filters'
import { isWithinDateRange } from '@/shared/utils/date'

// ============================================================
// CUENTAS CORRIENTES — paginado server-side (M7/3.5). Reemplaza a la
// tabla HTML propia de ClientAccountsTable, que recibia el array
// completo ya filtrado por ClientsPage. Solo busqueda por nombre/CUIT
// (M6) — zona/vendedor/estado del filtro superior siguen aplicando
// unicamente al Directorio (fuera de alcance de esta tarea, ver
// DECISIONES_TECNICAS.md): agregarlos al contrato paginado no fue
// pedido y hubiera sido diseñar filtros que nadie definio.
//
// COPIADO LITERAL desde services/mock/clients.service.ts (Tanda 3d) —
// sin ningun cambio de logica, prohibido tocarla.
// ============================================================

function hasTransactionInRange(
  client: ClientAccount,
  dateFrom: string | undefined,
  dateTo: string | undefined
): boolean {
  if (!dateFrom && !dateTo) return true
  return client.transactions.some(t => isWithinDateRange(t.date, dateFrom, dateTo))
}

function compareClientAccounts(
  a: ClientAccount,
  b: ClientAccount,
  field: ClientAccountsSortField
): number {
  switch (field) {
    case 'currentBalance':
      return a.currentBalance - b.currentBalance
    case 'creditLimit':
      return a.creditLimit - b.creditLimit
    case 'clientName':
    default:
      return a.clientName.localeCompare(b.clientName)
  }
}

// Compartido entre getClientAccountsPage y exportClientAccounts (no se
// duplica la logica de filtrado entre paginado y export).
function filterClientAccountsInScope(filters: ClientAccountsQueryFilters): ClientAccount[] {
  return listClients().filter(
    c =>
      matchesSearch(c.clientName, c.cuit, filters.search) &&
      hasTransactionInRange(c, filters.dateFrom, filters.dateTo)
  )
}

function sortClientAccounts(
  clients: ClientAccount[],
  sort: { field: ClientAccountsSortField; direction: 'asc' | 'desc' } | undefined
): ClientAccount[] {
  const sortField = sort?.field ?? 'clientName'
  const direction = sort?.direction ?? 'asc'
  return [...clients].sort((a, b) => {
    const cmp = compareClientAccounts(a, b, sortField)
    const primary = direction === 'asc' ? cmp : -cmp
    // Desempate estable por id (3.3): un orden ambiguo hace que el
    // mismo cliente aparezca en dos paginas o en ninguna al paginar.
    return primary !== 0 ? primary : a.id.localeCompare(b.id)
  })
}

export async function getClientAccountsPage(
  query: PageQuery<ClientAccountsQueryFilters, ClientAccountsSortField>,
  signal?: AbortSignal
): Promise<PageResult<ClientAccount>> {
  return httpClient.request<PageResult<ClientAccount>>({
    method: 'GET',
    path: '/clients/accounts',
    params: {
      empresaId: query.filters.empresaId,
      search: query.filters.search,
      dateFrom: query.filters.dateFrom,
      dateTo: query.filters.dateTo,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const { filters, sort, page, pageSize } = query
      const sorted = sortClientAccounts(filterClientAccountsInScope(filters), sort)

      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const safePage = Math.min(Math.max(1, page), totalPages)
      const start = (safePage - 1) * pageSize
      const items = sorted.slice(start, start + pageSize)

      return { items: structuredClone(items), total, page: safePage, pageSize }
    },
  })
}

// Exportar (tarea transversal, DECISIONES_TECNICAS.md): TODO lo que
// matchea filtros, sin paginar, hasta MAX_EXPORT_ROWS.
export async function exportClientAccounts(
  filters: ClientAccountsQueryFilters,
  sort?: { field: ClientAccountsSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<ClientAccount>> {
  return httpClient.request<ExportResult<ClientAccount>>({
    method: 'GET',
    path: '/clients/accounts/export',
    params: {
      empresaId: filters.empresaId,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    mock: () => {
      const sorted = sortClientAccounts(filterClientAccountsInScope(filters), sort)
      const truncated = sorted.length > MAX_EXPORT_ROWS
      const items = sorted.slice(0, MAX_EXPORT_ROWS)

      return { items: structuredClone(items), truncated }
    },
  })
}
