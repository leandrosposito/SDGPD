import type { Trip, CapacityOverrideEvent } from '@/shared/types/trip.types'
import type { TripId, StopId, DeliveryId } from '@/shared/types/ids.types'
import { computeCapacidadUsada, excedeCapacidad } from '@/shared/utils/tripCapacity'
import { httpClient } from '@/shared/api/httpClient'
import { withIdempotency } from '@/shared/utils/idempotency'
import { getVehicleById } from '@/shared/api/vehicles/vehicles.service'
import { getDeliveryIdsMatchingFilter } from './deliveries.service'
import type {
  AssignDeliveriesInput,
  AssignDeliveriesOptions,
  AssignDeliveriesConflict,
  AssignDeliveriesResult,
} from './trips.types'
import {
  findTrip,
  findTripContainingDelivery,
  saveTrip,
  nowISO,
  withComputedFields,
} from './trips.store'

export const MAX_TRIP_ASSIGNMENT = 100

// ------------------------------------------------------------
// releaseDeliveryFromTrip — ADR-013 seccion 1. Llamada "servidor a
// servidor" (mismo criterio que getDeliveryById/getVehicleById — sin
// pasar por httpClient, sin duplicar latencia simulada) desde
// deliveries.service.ts#reprogramDelivery, en la direccion CONTRARIA a
// la que este archivo ya usa hacia deliveries.service.ts — ver el
// comentario en deliveries.service.ts sobre por que es seguro.
//
// No-op si la entrega no esta asignada a ninguna Parada hoy — no es un
// error, la mayoria de las reprogramaciones son de entregas que
// todavia no se asignaron a ningun viaje.
// ------------------------------------------------------------
export function releaseDeliveryFromTrip(deliveryId: DeliveryId): void {
  const trip = findTripContainingDelivery(deliveryId)
  if (!trip) return

  const paradas = trip.paradas.map(s =>
    s.deliveryIds.includes(deliveryId)
      ? { ...s, deliveryIds: s.deliveryIds.filter(id => id !== deliveryId) }
      : s
  )
  const capacidadUsada = computeCapacidadUsada(paradas)
  const vehicle = getVehicleById(trip.vehicleId)
  // Liberar una entrega solo puede BAJAR capacidadUsada — pero si el
  // viaje ya estaba sobrecargado por varias entregas, sacar una sola
  // no necesariamente lo deja dentro del limite: se recalcula de
  // verdad, nunca se asume `false` a secas.
  const sobrecargado = vehicle !== undefined && excedeCapacidad(capacidadUsada, vehicle.capacidad)
  const updated: Trip = {
    ...trip,
    paradas,
    capacidadUsada,
    sobrecargado,
    version: trip.version + 1,
    updatedAt: nowISO(),
  }
  saveTrip(updated)
}

// ============================================================
// Asignacion de entregas a una parada (ADR-011 secciones 1/2/3)
// ============================================================

export async function assignDeliveriesToStop(
  empresaId: string,
  idempotencyKey: string,
  tripId: TripId,
  stopId: StopId,
  input: AssignDeliveriesInput,
  options: AssignDeliveriesOptions,
  quien: string
): Promise<AssignDeliveriesResult> {
  return httpClient.request<AssignDeliveriesResult>({
    method: 'POST',
    path: `/trips/${tripId}/stops/${stopId}/assign`,
    body: { empresaId, idempotencyKey, tripId, stopId, input, ...options },
    idempotencyKey,
    mock: () =>
      withIdempotency(idempotencyKey, () => {
        const trip = findTrip(tripId)
        if (!trip || !trip.paradas.some(s => s.id === stopId)) {
          return { success: false, reason: 'not-found' as const }
        }
        if (trip.version !== options.expectedVersion) {
          return { success: false, reason: 'stale-version' as const }
        }

        // Resuelve la lista de candidatos: 'lista' explicita, o
        // 'filtro' reaplicado server-side (ADR-011 seccion 1) contra el
        // MISMO matcher que usa getDeliveriesPage — nunca reinterpretado
        // aca.
        const candidateIds =
          input.modo === 'lista'
            ? input.deliveryIds
            : getDeliveryIdsMatchingFilter({ empresaId, ...input.filtros }).filter(
                id => !input.excluidos.includes(id)
              )

        if (candidateIds.length > MAX_TRIP_ASSIGNMENT) {
          return {
            success: false,
            reason: 'exceeds-limit' as const,
            matched: candidateIds.length,
            limit: MAX_TRIP_ASSIGNMENT,
          }
        }

        // Concurrencia granular (ADR-011 seccion 3, correccion): cada
        // deliveryId ya tomado por OTRO viaje se reporta como conflicto
        // puntual; los que siguen libres se aplican igual.
        const conflictos: AssignDeliveriesConflict[] = []
        const libres: DeliveryId[] = []
        for (const deliveryId of candidateIds) {
          const owner = findTripContainingDelivery(deliveryId)
          if (owner && owner.id !== tripId) {
            conflictos.push({ deliveryId, asignadoATripId: owner.id })
          } else {
            libres.push(deliveryId)
          }
        }

        const paradasConAsignacion = trip.paradas.map(s =>
          s.id === stopId ? { ...s, deliveryIds: [...new Set([...s.deliveryIds, ...libres])] } : s
        )
        const capacidadUsada = computeCapacidadUsada(paradasConAsignacion)
        const vehicle = getVehicleById(trip.vehicleId)
        const sobrecargado =
          vehicle !== undefined && excedeCapacidad(capacidadUsada, vehicle.capacidad)

        if (sobrecargado && !options.forzar) {
          return { success: false, reason: 'exceeds-capacity' as const }
        }
        if (sobrecargado && options.forzar && !options.forzar.motivo.trim()) {
          return { success: false, reason: 'motivo-requerido' as const }
        }

        const now = nowISO()
        const overrideEvent: CapacityOverrideEvent[] = sobrecargado
          ? [
              {
                quien,
                cuando: now,
                motivo: options.forzar!.motivo,
                deltaBultos: capacidadUsada.bultos - (vehicle?.capacidad.bultos ?? 0),
              },
            ]
          : []

        const updated: Trip = {
          ...trip,
          paradas: paradasConAsignacion,
          version: trip.version + 1,
          capacidadUsada,
          sobrecargado,
          overrides: [...trip.overrides, ...overrideEvent],
          updatedAt: now,
        }
        saveTrip(updated)

        return {
          success: true,
          trip: structuredClone(withComputedFields(updated)),
          conflictos: conflictos.length > 0 ? conflictos : undefined,
          asignados: libres,
        }
      }),
  })
}
