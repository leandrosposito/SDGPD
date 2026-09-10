import type { Vehicle, VehicleCapacity } from '@/shared/types/vehicle.types';
import type { VehicleId } from '@/shared/types/ids.types';
import { asVehicleId } from '@/shared/types/ids.types';
import type { PageQuery, PageResult } from '@/shared/types/pagination.types';
import { VEHICLES_MOCK_DATA } from '@/data/mock/vehicles.data';
import { httpClient } from '@/shared/api/httpClient';
import { withIdempotency } from '@/shared/utils/idempotency';

// ============================================================
// vehicles.service — Flota de vehiculos (Tanda 10B, ADR-011). Vive en
// shared/api (no en modules/logistics/) porque es alcance EMPRESA, no
// SUCURSAL — ver vehicle.types.ts para el porque. Mismo patron de
// idempotencia que deliveries.service.ts (withIdempotency, extraido a
// shared/utils/idempotency.ts en esta misma tanda).
// ============================================================

let vehiclesStore: Vehicle[] = structuredClone(VEHICLES_MOCK_DATA);

export interface VehiclesQueryFilters {
  empresaId: string;
  search?: string;
  soloActivos?: boolean;
}

export type VehiclesSortField = 'patente' | 'tipo';

function matchesFilters(v: Vehicle, filters: VehiclesQueryFilters): boolean {
  const search = filters.search?.trim().toLowerCase();
  const matchesSearch = !search || v.patente.toLowerCase().includes(search) || v.tipo.toLowerCase().includes(search);
  const matchesActivo = !filters.soloActivos || v.activo;
  return matchesSearch && matchesActivo;
}

function compareVehicles(a: Vehicle, b: Vehicle, field: VehiclesSortField): number {
  switch (field) {
    case 'tipo':
      return a.tipo.localeCompare(b.tipo);
    case 'patente':
    default:
      return a.patente.localeCompare(b.patente);
  }
}

// query.filters (no un empresaId suelto): Fase C, hallazgo propio —
// ver el comentario de trips.service.ts#getTripsPage, mismo motivo
// exacto (usePagedQuery exige `fetchPage` como referencia ESTABLE
// exportada del service; envolverla en un arrow inline en
// VehiclesPage.tsx le daba `.name === ''`, y dos listados con
// `filters` de la misma forma — ej. Vehiculos y Choferes, ambos
// {empresaId, search} — terminaban compartiendo la MISMA query key de
// TanStack Query).
export async function getVehiclesPage(
  query: PageQuery<VehiclesQueryFilters, VehiclesSortField>,
  signal?: AbortSignal
): Promise<PageResult<Vehicle, undefined>> {
  return httpClient.request<PageResult<Vehicle, undefined>>({
    method: 'GET',
    path: '/vehicles',
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
      const inScope = vehiclesStore.filter((v) => matchesFilters(v, query.filters));
      const sortField = query.sort?.field ?? 'patente';
      const direction = query.sort?.direction ?? 'asc';
      const sorted = [...inScope].sort((a, b) => {
        const cmp = compareVehicles(a, b, sortField);
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

export interface VehicleFormInput {
  patente: string;
  tipo: string;
  capacidad: VehicleCapacity;
}

export type VehicleMutationReason = 'not-found' | 'patente-duplicada';

export interface VehicleMutationResult {
  success: boolean;
  vehicle?: Vehicle;
  reason?: VehicleMutationReason;
}

// Tanda 11: patente unica por empresa, normalizada — mayusculas y sin
// espacios (formatos reales varian: "AB123CD" Mercosur, "ABC123"
// viejo — ambos alfanumericos, ninguno usa guiones, asi que no hace
// falta stripear mas que espacios). Se normaliza tanto lo GUARDADO
// como lo COMPARADO: a diferencia del SKU de ProductFormModal (que
// preserva may/minuscula tal como lo tipeo el usuario y solo compara
// case-insensitive), una patente es un identificador canonico con una
// convencion real de escritura — guardar "ab123cd" y "AB123CD" como
// si fueran dos vehiculos distintos seria el bug, no una eleccion de
// estilo.
function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

function isPatenteDuplicada(patenteNormalizada: string, excludeVehicleId?: VehicleId): boolean {
  return vehiclesStore.some((v) => v.id !== excludeVehicleId && normalizePatente(v.patente) === patenteNormalizada);
}

export async function createVehicle(
  empresaId: string,
  idempotencyKey: string,
  input: VehicleFormInput
): Promise<VehicleMutationResult> {
  return httpClient.request<VehicleMutationResult>({
    method: 'POST',
    path: '/vehicles',
    body: { empresaId, idempotencyKey, ...input },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const patente = normalizePatente(input.patente);
        if (isPatenteDuplicada(patente)) {
          return { success: false, reason: 'patente-duplicada' as const };
        }
        const vehicle: Vehicle = {
          id: asVehicleId(`veh-${Date.now()}`),
          patente,
          tipo: input.tipo,
          capacidad: input.capacidad,
          activo: true,
        };
        vehiclesStore = [...vehiclesStore, vehicle];
        return { success: true, vehicle };
      }),
  });
}

export async function updateVehicle(
  empresaId: string,
  idempotencyKey: string,
  vehicleId: VehicleId,
  input: VehicleFormInput
): Promise<VehicleMutationResult> {
  return httpClient.request<VehicleMutationResult>({
    method: 'PUT',
    path: `/vehicles/${vehicleId}`,
    body: { empresaId, idempotencyKey, ...input },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const existing = vehiclesStore.find((v) => v.id === vehicleId);
        if (!existing) {
          return { success: false, reason: 'not-found' as const };
        }
        const patente = normalizePatente(input.patente);
        if (isPatenteDuplicada(patente, vehicleId)) {
          return { success: false, reason: 'patente-duplicada' as const };
        }
        const updated: Vehicle = { ...existing, patente, tipo: input.tipo, capacidad: input.capacidad };
        vehiclesStore = vehiclesStore.map((v) => (v.id === vehicleId ? updated : v));
        return { success: true, vehicle: updated };
      }),
  });
}

export async function toggleVehicleActivo(
  empresaId: string,
  idempotencyKey: string,
  vehicleId: VehicleId
): Promise<VehicleMutationResult> {
  return httpClient.request<VehicleMutationResult>({
    method: 'PUT',
    path: `/vehicles/${vehicleId}/toggle-activo`,
    body: { empresaId, idempotencyKey },
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const existing = vehiclesStore.find((v) => v.id === vehicleId);
        if (!existing) {
          return { success: false, reason: 'not-found' as const };
        }
        const updated: Vehicle = { ...existing, activo: !existing.activo };
        vehiclesStore = vehiclesStore.map((v) => (v.id === vehicleId ? updated : v));
        return { success: true, vehicle: updated };
      }),
  });
}

// Consumido por CreateTripModal (dropdown de vehiculo con capacidad
// visible) — sin paginar, mismo criterio que fetchSuppliers: universo
// chico (flota de la empresa), no un listado que crezca sin techo.
export async function fetchActiveVehicles(empresaId: string, signal?: AbortSignal): Promise<Vehicle[]> {
  return httpClient.request<Vehicle[]>({
    method: 'GET',
    path: '/vehicles/active',
    params: { empresaId },
    signal,
    mock: () => structuredClone(vehiclesStore.filter((v) => v.activo)),
  });
}

// Llamada "servidor a servidor" (mismo criterio que
// deliveries.service.ts#getDeliveryById) — trips.service.ts la necesita
// para resolver la capacidad TOTAL del vehiculo asignado a un viaje
// (capacidadTotal no se duplica en Trip, ver trip.types.ts) sin pasar
// por httpClient (evita anidar latencia simulada en cada calculo de
// capacidad).
export function getVehicleById(vehicleId: VehicleId): Vehicle | undefined {
  return vehiclesStore.find((v) => v.id === vehicleId);
}
