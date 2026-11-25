import type { Driver } from '@/shared/types/driver.types'
import type { DriverId } from '@/shared/types/ids.types'
import { asDriverId } from '@/shared/types/ids.types'
import type { PageQuery, PageResult } from '@/shared/types/pagination.types'
import { DRIVERS_MOCK_DATA } from '@/data/mock/drivers.data'
import { driverPageSchema, driverSchema, type Driver as DriverDTO } from '@sdgpd/contracts'
import { httpClient, isHttpService } from '@/shared/api/httpClient'
import { ApiError } from '@/shared/api/ApiError'
import { withIdempotency } from '@/shared/utils/idempotency'

// ============================================================
// drivers.service — Choferes (Tanda 10B, ADR-011). Mismo criterio de
// alcance/idempotencia/paginado que vehicles.service.ts — ver ese
// archivo para el razonamiento completo (no repetido aca).
// ============================================================

let driversStore: Driver[] = structuredClone(DRIVERS_MOCK_DATA)

// BE-2: con 'drivers' por http, wire de @sdgpd/contracts validado con su schema
// (mismo criterio que vehicles.service.ts, ver ahi el razonamiento).
function driverFromWire(dto: DriverDTO): Driver {
  return {
    id: asDriverId(dto.id),
    nombre: dto.nombre,
    licencia: dto.licencia,
    telefono: dto.telefono,
    activo: dto.activo,
    version: dto.version,
  }
}

function reasonFromError(error: unknown): DriverMutationReason | undefined {
  if (!(error instanceof ApiError)) return undefined
  if (error.serverCode === 'not-found') return 'not-found'
  if (error.serverCode === 'version-conflict') return 'version-conflict'
  return undefined
}

async function httpMutation(request: () => Promise<unknown>): Promise<DriverMutationResult> {
  try {
    return { success: true, driver: driverFromWire(driverSchema.parse(await request())) }
  } catch (error) {
    const reason = reasonFromError(error)
    if (reason) return { success: false, reason }
    throw error
  }
}

const NO_MOCK = (): never => {
  throw new Error('drivers: el mock no aplica con el service por http.')
}

export interface DriversQueryFilters {
  empresaId: string
  search?: string
  soloActivos?: boolean
}

export type DriversSortField = 'nombre' | 'licencia'

function matchesFilters(d: Driver, filters: DriversQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase()
  const matchesSearch =
    !search || d.nombre.toLowerCase().includes(search) || d.licencia.toLowerCase().includes(search)
  const matchesActivo = !filters.soloActivos || d.activo
  return matchesSearch && matchesActivo
}

function compareDrivers(a: Driver, b: Driver, field: DriversSortField): number {
  switch (field) {
    case 'licencia':
      return a.licencia.localeCompare(b.licencia)
    case 'nombre':
    default:
      return a.nombre.localeCompare(b.nombre)
  }
}

// query.filters (no un empresaId suelto) — mismo hallazgo/motivo que
// vehicles.service.ts#getVehiclesPage (Fase C).
export async function getDriversPage(
  query: PageQuery<DriversQueryFilters, DriversSortField>,
  signal?: AbortSignal
): Promise<PageResult<Driver, undefined>> {
  const page = await httpClient.request<PageResult<Driver, undefined>>({
    method: 'GET',
    path: 'drivers',
    service: 'drivers',
    params: {
      search: query.filters.search,
      soloActivos: query.filters.soloActivos,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const inScope = driversStore.filter(d => matchesFilters(d, query.filters))
      const sortField = query.sort?.field ?? 'nombre'
      const direction = query.sort?.direction ?? 'asc'
      const sorted = [...inScope].sort((a, b) => {
        const cmp = compareDrivers(a, b, sortField)
        const primary = direction === 'asc' ? cmp : -cmp
        return primary !== 0 ? primary : a.id.localeCompare(b.id)
      })

      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
      const safePage = Math.min(Math.max(1, query.page), totalPages)
      const start = (safePage - 1) * query.pageSize

      return {
        items: structuredClone(sorted.slice(start, start + query.pageSize)),
        total,
        page: safePage,
        pageSize: query.pageSize,
      }
    },
  })
  if (!isHttpService('drivers')) return page
  const parsed = driverPageSchema.parse(page)
  return { ...parsed, items: parsed.items.map(driverFromWire) }
}

export interface DriverFormInput {
  nombre: string
  licencia: string
  telefono: string
}

export type DriverMutationReason = 'not-found' | 'version-conflict'

export interface DriverMutationResult {
  success: boolean
  driver?: Driver
  reason?: DriverMutationReason
}

export async function createDriver(
  empresaId: string,
  idempotencyKey: string,
  input: DriverFormInput
): Promise<DriverMutationResult> {
  if (isHttpService('drivers')) {
    return httpMutation(() =>
      httpClient.request<unknown>({
        method: 'POST',
        path: 'drivers',
        service: 'drivers',
        body: input,
        idempotencyKey,
        mock: NO_MOCK,
      })
    )
  }
  return httpClient.request<DriverMutationResult>({
    method: 'POST',
    path: '/drivers',
    body: { empresaId, idempotencyKey, ...input },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const driver: Driver = {
          id: asDriverId(`drv-${Date.now()}`),
          nombre: input.nombre,
          licencia: input.licencia,
          telefono: input.telefono,
          activo: true,
        }
        driversStore = [...driversStore, driver]
        return { success: true, driver }
      }),
  })
}

export async function updateDriver(
  empresaId: string,
  idempotencyKey: string,
  driverId: DriverId,
  input: DriverFormInput,
  // BE-2: la version que leyo el formulario (409 version-conflict si cambio). Solo la usa http.
  version?: number
): Promise<DriverMutationResult> {
  if (isHttpService('drivers')) {
    return httpMutation(() =>
      httpClient.request<unknown>({
        method: 'PUT',
        path: `drivers/${driverId}`,
        service: 'drivers',
        body: { ...input, version },
        idempotencyKey,
        mock: NO_MOCK,
      })
    )
  }
  return httpClient.request<DriverMutationResult>({
    method: 'PUT',
    path: `/drivers/${driverId}`,
    body: { empresaId, idempotencyKey, ...input },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const existing = driversStore.find(d => d.id === driverId)
        if (!existing) {
          return { success: false, reason: 'not-found' as const }
        }
        const updated: Driver = {
          ...existing,
          nombre: input.nombre,
          licencia: input.licencia,
          telefono: input.telefono,
        }
        driversStore = driversStore.map(d => (d.id === driverId ? updated : d))
        return { success: true, driver: updated }
      }),
  })
}

export async function toggleDriverActivo(
  empresaId: string,
  idempotencyKey: string,
  driverId: DriverId,
  // BE-2: estado y version leidos; el backend tiene activate/deactivate (ADR-BE-004, sub-decision 2).
  current?: Pick<Driver, 'activo' | 'version'>
): Promise<DriverMutationResult> {
  if (isHttpService('drivers')) {
    return httpMutation(() =>
      httpClient.request<unknown>({
        method: 'POST',
        path: `drivers/${driverId}/${current?.activo ? 'deactivate' : 'activate'}`,
        service: 'drivers',
        body: { version: current?.version },
        idempotencyKey,
        mock: NO_MOCK,
      })
    )
  }
  return httpClient.request<DriverMutationResult>({
    method: 'PUT',
    path: `/drivers/${driverId}/toggle-activo`,
    body: { empresaId, idempotencyKey },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const existing = driversStore.find(d => d.id === driverId)
        if (!existing) {
          return { success: false, reason: 'not-found' as const }
        }
        const updated: Driver = { ...existing, activo: !existing.activo }
        driversStore = driversStore.map(d => (d.id === driverId ? updated : d))
        return { success: true, driver: updated }
      }),
  })
}

// Consumido por CreateTripModal (dropdown de chofer) — mismo criterio
// que fetchActiveVehicles.
export async function fetchActiveDrivers(
  empresaId: string,
  signal?: AbortSignal
): Promise<Driver[]> {
  if (isHttpService('drivers')) {
    const page = await httpClient.request<unknown>({
      method: 'GET',
      path: 'drivers',
      service: 'drivers',
      params: { soloActivos: true, pageSize: 100 },
      signal,
      mock: NO_MOCK,
    })
    return driverPageSchema.parse(page).items.map(driverFromWire)
  }
  return httpClient.request<Driver[]>({
    method: 'GET',
    path: '/drivers/active',
    params: { empresaId },
    signal,
    mock: () => structuredClone(driversStore.filter(d => d.activo)),
  })
}
