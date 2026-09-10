import type { Driver } from '@/shared/types/driver.types';
import type { DriverId } from '@/shared/types/ids.types';
import { asDriverId } from '@/shared/types/ids.types';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { DRIVERS_MOCK_DATA } from '@/data/mock/drivers.data';
import { httpClient } from '@/shared/api/httpClient';
import { withIdempotency } from '@/shared/utils/idempotency';

// ============================================================
// drivers.service — Choferes (Tanda 10B, ADR-011). Mismo criterio de
// alcance/idempotencia/paginado que vehicles.service.ts — ver ese
// archivo para el razonamiento completo (no repetido aca).
// ============================================================

let driversStore: Driver[] = structuredClone(DRIVERS_MOCK_DATA);

export interface DriversQueryFilters {
  empresaId: string;
  search?: string;
  soloActivos?: boolean;
}

export type DriversSortField = 'nombre' | 'licencia';

function matchesFilters(d: Driver, filters: DriversQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase();
  const matchesSearch = !search || d.nombre.toLowerCase().includes(search) || d.licencia.toLowerCase().includes(search);
  const matchesActivo = !filters.soloActivos || d.activo;
  return matchesSearch && matchesActivo;
}

function compareDrivers(a: Driver, b: Driver, field: DriversSortField): number {
  switch (field) {
    case 'licencia':
      return a.licencia.localeCompare(b.licencia);
    case 'nombre':
    default:
      return a.nombre.localeCompare(b.nombre);
  }
}

// query.filters (no un empresaId suelto) — mismo hallazgo/motivo que
// vehicles.service.ts#getVehiclesPage (Fase C).
export async function getDriversPage(
  query: PageQuery<DriversQueryFilters, DriversSortField>,
  signal?: AbortSignal
): Promise<PageResult<Driver, undefined>> {
  return httpClient.request<PageResult<Driver, undefined>>({
    method: 'GET',
    path: '/drivers',
    params: {
      empresaId: query.filters.empresaId,
      search: query.filters.search,
      soloActivos: query.filters.soloActivos,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const inScope = driversStore.filter((d) => matchesFilters(d, query.filters));
      const sortField = query.sort?.field ?? 'nombre';
      const direction = query.sort?.direction ?? 'asc';
      const sorted = [...inScope].sort((a, b) => {
        const cmp = compareDrivers(a, b, sortField);
        const primary = direction === 'asc' ? cmp : -cmp;
        return primary !== 0 ? primary : a.id.localeCompare(b.id);
      });

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const safePage = Math.min(Math.max(1, query.page), totalPages);
      const start = (safePage - 1) * query.pageSize;

      return {
        items: structuredClone(sorted.slice(start, start + query.pageSize)),
        total,
        page: safePage,
        pageSize: query.pageSize,
      };
    },
  });
}

export interface DriverFormInput {
  nombre: string;
  licencia: string;
  telefono: string;
}

export type DriverMutationReason = 'not-found';

export interface DriverMutationResult {
  success: boolean;
  driver?: Driver;
  reason?: DriverMutationReason;
}

export async function createDriver(empresaId: string, idempotencyKey: string, input: DriverFormInput): Promise<DriverMutationResult> {
  return httpClient.request<DriverMutationResult>({
    method: 'POST',
    path: '/drivers',
    body: { empresaId, idempotencyKey, ...input },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const driver: Driver = { id: asDriverId(`drv-${Date.now()}`), nombre: input.nombre, licencia: input.licencia, telefono: input.telefono, activo: true };
        driversStore = [...driversStore, driver];
        return { success: true, driver };
      }),
  });
}

export async function updateDriver(
  empresaId: string,
  idempotencyKey: string,
  driverId: DriverId,
  input: DriverFormInput
): Promise<DriverMutationResult> {
  return httpClient.request<DriverMutationResult>({
    method: 'PUT',
    path: `/drivers/${driverId}`,
    body: { empresaId, idempotencyKey, ...input },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const existing = driversStore.find((d) => d.id === driverId);
        if (!existing) {
          return { success: false, reason: 'not-found' as const };
        }
        const updated: Driver = { ...existing, nombre: input.nombre, licencia: input.licencia, telefono: input.telefono };
        driversStore = driversStore.map((d) => (d.id === driverId ? updated : d));
        return { success: true, driver: updated };
      }),
  });
}

export async function toggleDriverActivo(empresaId: string, idempotencyKey: string, driverId: DriverId): Promise<DriverMutationResult> {
  return httpClient.request<DriverMutationResult>({
    method: 'PUT',
    path: `/drivers/${driverId}/toggle-activo`,
    body: { empresaId, idempotencyKey },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const existing = driversStore.find((d) => d.id === driverId);
        if (!existing) {
          return { success: false, reason: 'not-found' as const };
        }
        const updated: Driver = { ...existing, activo: !existing.activo };
        driversStore = driversStore.map((d) => (d.id === driverId ? updated : d));
        return { success: true, driver: updated };
      }),
  });
}

// Consumido por CreateTripModal (dropdown de chofer) — mismo criterio
// que fetchActiveVehicles.
export async function fetchActiveDrivers(empresaId: string, signal?: AbortSignal): Promise<Driver[]> {
  return httpClient.request<Driver[]>({
    method: 'GET',
    path: '/drivers/active',
    params: { empresaId },
    signal,
    mock: () => structuredClone(driversStore.filter((d) => d.activo)),
  });
}
