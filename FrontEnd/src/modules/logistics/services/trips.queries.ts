import type { Trip, TripPosition } from '@/shared/types/trip.types'
import type { TripId } from '@/shared/types/ids.types'
import type { PageQuery, PageResult } from '@/shared/types/pagination.types'
import { httpClient } from '@/shared/api/httpClient'
import type { TripQueryFilters, TripSortField, TripPositionQueryFilters } from './trips.types'
import { findTrip, listTrips, withComputedFields } from './trips.store'

export const MAX_ROUTE_POINTS = 500

// ============================================================
// Lectura paginada + por id
// ============================================================

function matchesTripFilters(t: Trip, filters: TripQueryFilters): boolean {
  return (
    t.branchId === filters.branchId &&
    (!filters.estado || t.estado === filters.estado) &&
    (!filters.fecha || t.fecha === filters.fecha) &&
    (!filters.vehicleId || t.vehicleId === filters.vehicleId) &&
    (!filters.driverId || t.driverId === filters.driverId)
  )
}

function compareTrips(a: Trip, b: Trip, field: TripSortField): number {
  switch (field) {
    case 'estado':
      return a.estado.localeCompare(b.estado)
    case 'fecha':
    default:
      return a.fecha.localeCompare(b.fecha)
  }
}

// Firma alineada con deliveries.service.ts#getDeliveriesPage a
// proposito (Fase C, hallazgo propio corregido en la misma sesion):
// la version anterior recibia branchId como parametro SUELTO en vez de
// dentro de `query.filters` — usePagedQuery arma la query key de
// TanStack Query solo a partir de `filters` (mas empresaId, que si lee
// de la sesion), asi que un branchId pasado por fuera de `filters`
// quedaba invisible para la key: cambiar de sucursal activa en
// TripsPage.tsx NO iba a disparar un refetch, serviria del cache la
// pagina de la sucursal VIEJA (regla 3.4 del protocolo, "toda query
// key incluye... branchId si el dominio es de alcance sucursal").
export async function getTripsPage(
  query: PageQuery<TripQueryFilters, TripSortField>,
  signal?: AbortSignal
): Promise<PageResult<Trip, undefined>> {
  const filters = query.filters
  return httpClient.request<PageResult<Trip, undefined>>({
    method: 'GET',
    path: '/trips',
    params: {
      empresaId: filters.empresaId,
      branchId: filters.branchId ?? undefined,
      estado: filters.estado,
      fecha: filters.fecha,
      vehicleId: filters.vehicleId,
      driverId: filters.driverId,
      page: query.page,
      pageSize: query.pageSize,
      sortField: query.sort?.field,
      sortDirection: query.sort?.direction,
    },
    signal,
    mock: () => {
      const inScope = listTrips().filter(t => matchesTripFilters(t, filters))
      const sortField = query.sort?.field ?? 'fecha'
      const direction = query.sort?.direction ?? 'desc'
      const sorted = [...inScope].sort((a, b) => {
        const cmp = compareTrips(a, b, sortField)
        const primary = direction === 'asc' ? cmp : -cmp
        return primary !== 0 ? primary : a.id.localeCompare(b.id)
      })

      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
      const safePage = Math.min(Math.max(1, query.page), totalPages)
      const start = (safePage - 1) * query.pageSize

      return {
        items: structuredClone(sorted.slice(start, start + query.pageSize).map(withComputedFields)),
        total,
        page: safePage,
        pageSize: query.pageSize,
      }
    },
  })
}

export async function getTripById(
  empresaId: string,
  tripId: TripId,
  signal?: AbortSignal
): Promise<Trip | null> {
  return httpClient.request<Trip | null>({
    method: 'GET',
    path: `/trips/${tripId}`,
    params: { empresaId },
    signal,
    mock: () => {
      const trip = findTrip(tripId)
      return trip ? structuredClone(withComputedFields(trip)) : null
    },
  })
}

// ============================================================
// Posicion en vivo (ADR-011 seccion 4). Enmienda 2026-09-09 de
// ADR-003: todo "tiempo real" pasa por useLiveQuery, nunca un
// setInterval paralelo — useLiveQuery esta construido sobre
// usePagedQuery (PageQuery/PageResult). Un punto de posicion no es
// una lista, pero envolverlo como una "pagina de 1 elemento" permite
// reusar exactamente el mismo mecanismo de polling (intervalMs
// configurable, refetchIntervalInBackground:false) sin inventar un
// hook de polling paralelo — decision tomada sin ADR propio (regla 2.9
// del protocolo), documentada aca porque ADR-011 seccion 4 describe el
// payload como "un solo punto" sin especificar como se conecta al
// mecanismo de tiempo real ya existente.
// ============================================================

export async function getTripPosition(
  query: PageQuery<TripPositionQueryFilters>,
  signal?: AbortSignal
): Promise<PageResult<TripPosition, undefined>> {
  const { tripId, empresaId } = query.filters
  return httpClient.request<PageResult<TripPosition, undefined>>({
    method: 'GET',
    path: `/trips/${tripId}/posicion`,
    params: { empresaId },
    signal,
    mock: () => {
      const trip = findTrip(tripId)
      const items = trip?.posicionActual ? [trip.posicionActual] : []
      return { items, total: items.length, page: 1, pageSize: 1 }
    },
  })
}

// ============================================================
// Recorrido historico (ADR-011 seccion 4): bajo demanda, simplificado
// server-side, techo MAX_ROUTE_POINTS. Sin almacenamiento real de
// trazas GPS en este mock (no hay dispositivo real empujando
// posiciones) — se sintetiza una traza corta y deterministica a partir
// de posicionActual para que el endpoint tenga algo real que devolver
// y decimar, documentado como simulacion (no hay traza cruda que
// decimar de verdad todavia).
// ============================================================

export async function getTripRoute(
  empresaId: string,
  tripId: TripId,
  signal?: AbortSignal
): Promise<TripPosition[]> {
  return httpClient.request<TripPosition[]>({
    method: 'GET',
    path: `/trips/${tripId}/recorrido`,
    params: { empresaId },
    signal,
    mock: () => {
      const trip = findTrip(tripId)
      if (!trip?.posicionActual) return []

      const { lat, lng, timestampServidor } = trip.posicionActual
      const base = new Date(timestampServidor).getTime()
      const synthetic: TripPosition[] = Array.from({ length: 5 }, (_, i) => ({
        lat: lat - (4 - i) * 0.002,
        lng: lng - (4 - i) * 0.002,
        timestampDispositivo: new Date(base - (4 - i) * 5 * 60_000).toISOString(),
        timestampServidor: new Date(base - (4 - i) * 5 * 60_000).toISOString(),
      }))
      return synthetic.slice(0, MAX_ROUTE_POINTS)
    },
  })
}
