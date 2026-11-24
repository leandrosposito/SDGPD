import type { Trip, Stop, TripStatus } from '@/shared/types/trip.types'
import type { TripId, StopId } from '@/shared/types/ids.types'
import { asTripId, asStopId } from '@/shared/types/ids.types'
import { puedeTransicionarViaje } from '@/shared/types/tripStatus.types'
import { computeCapacidadUsada } from '@/shared/utils/tripCapacity'
import { httpClient } from '@/shared/api/httpClient'
import { withIdempotency } from '@/shared/utils/idempotency'
import { getVehicleById } from '@/shared/api/vehicles/vehicles.service'
import type {
  CreateTripInput,
  CreateTripResult,
  TransitionTripResult,
  UpdateStopOrderResult,
} from './trips.types'
import { addTrip, findTrip, saveTrip, nowISO, withComputedFields } from './trips.store'

// ============================================================
// Alta de viaje
// ============================================================

export async function createTrip(
  empresaId: string,
  idempotencyKey: string,
  input: CreateTripInput,
  quien: string
): Promise<CreateTripResult> {
  return httpClient.request<CreateTripResult>({
    method: 'POST',
    path: '/trips',
    body: { empresaId, idempotencyKey, ...input },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const vehicle = getVehicleById(input.vehicleId)
        if (!vehicle) {
          return { success: false, reason: 'vehicle-not-found' as const }
        }

        const now = nowISO()
        const id = asTripId(`trip-${Date.now()}`)
        const paradas: Stop[] = input.paradas.map((stop, index) => ({
          id: asStopId(`stop-${Date.now()}-${index}`),
          tripId: id,
          orden: index + 1,
          clientName: stop.clientName,
          address: stop.address,
          deliveryIds: [],
          estado: 'Pendiente',
          preferenciasEntrega: null,
        }))

        const trip: Trip = {
          id,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          branchId: input.branchId,
          empresaId,
          fecha: input.fecha,
          estado: 'Planificado',
          paradas,
          version: 1,
          capacidadUsada: computeCapacidadUsada(paradas),
          sobrecargado: false,
          overrides: [],
          createdAt: now,
          updatedAt: now,
        }

        addTrip(trip)
        void quien // sin historial de viaje en esta tanda (ver comentario de transitionTrip) — quien queda reservado para cuando se agregue.
        return { success: true, trip: structuredClone(withComputedFields(trip)) }
      }),
  })
}

// ============================================================
// Maquina de estados del viaje (ADR-011, mismo patron que
// transitionDelivery en deliveries.service.ts)
// ============================================================

// Sin historial de eventos propio para Trip en esta tanda (a
// diferencia de Delivery.historial, ADR-002) — no esta pedido por
// ADR-011 ni por la tarea. `quien` se recibe igual (misma firma que
// transitionDelivery) para cuando se agregue, sin usarse todavia.
export async function transitionTrip(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  hasta: TripStatus,
  quien: string
): Promise<TransitionTripResult> {
  return httpClient.request<TransitionTripResult>({
    method: 'PUT',
    path: `/trips/${tripId}/transition`,
    body: { empresaId, idempotencyKey, hasta, quien },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        void quien
        const trip = findTrip(tripId)
        if (!trip) {
          return { success: false, tripId, reason: 'not-found' as const }
        }
        if (!puedeTransicionarViaje(trip.estado, hasta)) {
          return {
            success: false,
            tripId,
            previousStatus: trip.estado,
            reason: 'invalid-transition' as const,
          }
        }

        const previousStatus = trip.estado
        const updated: Trip = {
          ...trip,
          estado: hasta,
          version: trip.version + 1,
          updatedAt: nowISO(),
        }
        saveTrip(updated)

        return { success: true, tripId, previousStatus, newStatus: hasta }
      }),
  })
}

// ============================================================
// Reordenar paradas (ADR-011 seccion 5): orden manual, sin
// optimizador — updateStopOrder solo reescribe `orden` segun la
// posicion del array recibido, nunca calcula una secuencia.
// ============================================================

export async function updateStopOrder(
  empresaId: string,
  tripId: TripId,
  stops: StopId[]
): Promise<UpdateStopOrderResult> {
  return httpClient.request<UpdateStopOrderResult>({
    method: 'PUT',
    path: `/trips/${tripId}/stops/order`,
    body: { empresaId, stops },
    mock: () => {
      const trip = findTrip(tripId)
      if (!trip) {
        return { success: false, reason: 'not-found' as const }
      }
      if (
        stops.length !== trip.paradas.length ||
        !stops.every(id => trip.paradas.some(s => s.id === id))
      ) {
        return { success: false, reason: 'stops-mismatch' as const }
      }

      const paradas = stops.map((stopId, index) => {
        const stop = trip.paradas.find(s => s.id === stopId)!
        return { ...stop, orden: index + 1 }
      })
      const updated: Trip = { ...trip, paradas, version: trip.version + 1, updatedAt: nowISO() }
      saveTrip(updated)

      return { success: true, trip: structuredClone(withComputedFields(updated)) }
    },
  })
}
