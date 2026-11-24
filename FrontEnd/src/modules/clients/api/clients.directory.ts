import type { ClientAccount } from '@/shared/types/client.types'
import type { PageQuery, PageResult, ExportResult } from '@/shared/types/pagination.types'
import { MAX_EXPORT_ROWS } from '@/shared/types/pagination.types'
import { httpClient } from '@/shared/api/httpClient'
import { ApiError } from '@/shared/api/ApiError'
import { asClientId, type ClientId } from '@/shared/types/ids.types'
import type { ClientAccountDTO, ClientsPageDTO } from './dto'
import { clientFromDTO, clientToDTO, clientFormInputToDTO, type ClientFormInput } from './mapper'
import type { ClientsQueryFilters, ClientsSortField } from './clients.types'
import { listClients, findClient, addClient, replaceClient } from './clients.store'

// ============================================================
// DIRECTORIO DE CLIENTES — paginado server-side (Tanda 3d). Los
// filtros de zona/vendedor/estado, que antes corrían en memoria en
// ClientsPage.tsx#filteredClients, pasan acá.
// ============================================================

function matchesDirectoryFilters(client: ClientAccount, filters: ClientsQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase()
  const matchesSearch =
    !search || client.clientName.toLowerCase().includes(search) || client.cuit.includes(search)
  const matchesZone = !filters.zone || client.zone === filters.zone
  const matchesSeller = !filters.seller || client.sellerName === filters.seller
  const matchesStatus = !filters.status || client.status === filters.status
  return matchesSearch && matchesZone && matchesSeller && matchesStatus
}

function resolveMockClientsPage(
  query: PageQuery<ClientsQueryFilters, ClientsSortField>
): ClientsPageDTO {
  const inScope = listClients().filter(c => matchesDirectoryFilters(c, query.filters))
  const sorted = [...inScope].sort((a, b) => {
    const cmp = a.clientName.localeCompare(b.clientName)
    return query.sort?.direction === 'desc' ? -cmp : cmp
  })

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const safePage = Math.min(Math.max(1, query.page), totalPages)
  const start = (safePage - 1) * query.pageSize

  return {
    data: sorted.slice(start, start + query.pageSize).map(clientToDTO),
    meta: { total, page: safePage, page_size: query.pageSize },
  }
}

export async function getClientsPage(
  query: PageQuery<ClientsQueryFilters, ClientsSortField>,
  signal?: AbortSignal
): Promise<PageResult<ClientAccount>> {
  const pageDTO = await httpClient.request<ClientsPageDTO>({
    method: 'GET',
    path: '/clients',
    params: {
      empresaId: query.filters.empresaId,
      search: query.filters.search,
      zone: query.filters.zone,
      seller: query.filters.seller,
      status: query.filters.status,
      page: query.page,
      pageSize: query.pageSize,
    },
    signal,
    mock: () => resolveMockClientsPage(query),
  })

  return {
    items: pageDTO.data.map(clientFromDTO),
    total: pageDTO.meta.total,
    page: pageDTO.meta.page,
    pageSize: pageDTO.meta.page_size,
  }
}

// Exportar Directorio de Clientes (mismo patron que exportClientAccounts,
// mas abajo): reusa matchesDirectoryFilters, no duplica el filtro.
export async function exportClients(
  filters: ClientsQueryFilters,
  sort?: { field: ClientsSortField; direction: 'asc' | 'desc' }
): Promise<ExportResult<ClientAccount>> {
  return httpClient.request<ExportResult<ClientAccount>>({
    method: 'GET',
    path: '/clients/export',
    params: {
      empresaId: filters.empresaId,
      search: filters.search,
      zone: filters.zone,
      seller: filters.seller,
      status: filters.status,
    },
    mock: () => {
      const inScope = listClients().filter(c => matchesDirectoryFilters(c, filters))
      const sorted = [...inScope].sort((a, b) => {
        const cmp = a.clientName.localeCompare(b.clientName)
        return sort?.direction === 'desc' ? -cmp : cmp
      })
      const truncated = sorted.length > MAX_EXPORT_ROWS
      const items = sorted.slice(0, MAX_EXPORT_ROWS)
      return { items: structuredClone(items), truncated }
    },
  })
}

// Catalogo completo, sin paginar (Tanda 5, ADR-006/AUDIT_4_IDS_RELACIONES.md
// hallazgo ALTO #1): alimenta el combobox de seleccion de cliente real de
// CreateOrderModal — mismo criterio que fetchProducts/fetchSuppliers (un
// combobox necesita el catalogo entero para buscar/filtrar en memoria,
// no un listado paginado). No usar para ninguna vista de exhibicion de
// listado — para eso esta getClientsPage, que si pagina server-side.
export async function fetchClientsCatalog(
  empresaId: string,
  signal?: AbortSignal
): Promise<ClientAccount[]> {
  return httpClient.request<ClientAccount[]>({
    method: 'GET',
    path: '/clients/catalog',
    params: { empresaId },
    signal,
    mock: () => structuredClone(listClients()),
  })
}

// Lookup de UN cliente por id (Tanda 17, ADR-015 punto 4): lo usa
// orders.service.ts#createOrder del lado del servidor para validar
// existencia y estado del cliente sin traer el catalogo entero — a
// proposito NO reusa fetchClientsCatalog, que es exactamente la deuda
// de ADR-016 (catalogo completo sin limite dentro de otro request).
// null = 404 (no existe en esta empresa); cualquier otro error se
// propaga.
export async function getClientById(
  empresaId: string,
  clientId: ClientId,
  signal?: AbortSignal
): Promise<ClientAccount | null> {
  try {
    const dto = await httpClient.request<ClientAccountDTO>({
      method: 'GET',
      path: `/clients/${clientId}`,
      params: { empresaId },
      signal,
      mock: () => {
        const client = findClient(clientId)
        if (!client) throw new ApiError(404, 'CLIENT_ERROR', 'El cliente no existe.')
        return clientToDTO(client)
      },
    })
    return clientFromDTO(dto)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function createClient(
  empresaId: string,
  input: ClientFormInput
): Promise<ClientAccount> {
  const dto = await httpClient.request<ClientAccountDTO>({
    method: 'POST',
    path: '/clients',
    body: { empresaId, ...clientFormInputToDTO(input) },
    mock: () => {
      const newClient: ClientAccount = {
        ...input,
        id: asClientId(`cli-${Date.now()}`),
        totalDebit: 0,
        totalCredit: 0,
        currentBalance: 0,
        daysOverdue: 0,
        status: 'Al dia',
        transactions: [],
      }
      addClient(newClient)
      return clientToDTO(newClient)
    },
  })
  return clientFromDTO(dto)
}

export async function updateClient(
  empresaId: string,
  id: string,
  input: ClientFormInput
): Promise<ClientAccount> {
  const dto = await httpClient.request<ClientAccountDTO>({
    method: 'PUT',
    path: `/clients/${id}`,
    body: { empresaId, ...clientFormInputToDTO(input) },
    mock: () => {
      const existing = findClient(id)
      if (!existing)
        throw new ApiError(404, 'CLIENT_ERROR', 'El cliente que intenta editar ya no existe.')

      const updated: ClientAccount = { ...existing, ...input }
      replaceClient(id, updated)
      return clientToDTO(updated)
    },
  })
  return clientFromDTO(dto)
}
