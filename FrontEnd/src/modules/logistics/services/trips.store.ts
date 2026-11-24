import { computeAllowedTripTransitions } from '@/shared/types/tripStatus.types'
import type { Trip } from '@/shared/types/trip.types'
import type { TripId, DeliveryId } from '@/shared/types/ids.types'
import { TRIPS_MOCK_DATA } from '@/data/mock/trips.data'

// ============================================================
// trips.store — Unica fuente de verdad de los viajes (mock).
// El arreglo vive aca y NUNCA se exporta: el resto de los archivos de
// viajes lo lee y lo modifica solo a traves de estas funciones, asi
// hay un solo lugar donde se reasigna.
// ============================================================

let tripsStore: Trip[] = structuredClone(TRIPS_MOCK_DATA)

export function listTrips(): Trip[] {
  return tripsStore
}

export function findTrip(tripId: TripId): Trip | undefined {
  return tripsStore.find(t => t.id === tripId)
}

export function findTripContainingDelivery(deliveryId: DeliveryId): Trip | undefined {
  return tripsStore.find(t => t.paradas.some(s => s.deliveryIds.includes(deliveryId)))
}

// Reemplaza el viaje con el mismo id por la version actualizada.
export function saveTrip(updated: Trip): void {
  tripsStore = tripsStore.map(t => (t.id === updated.id ? updated : t))
}

export function addTrip(trip: Trip): void {
  tripsStore = [...tripsStore, trip]
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function withComputedFields(trip: Trip): Trip {
  return { ...trip, allowedTransitions: computeAllowedTripTransitions(trip.estado) }
}
