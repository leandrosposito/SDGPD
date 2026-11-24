import type { Trip, TripStatus } from '@/shared/types/trip.types'
import type { TripId, VehicleId, DriverId, DeliveryId, BranchId } from '@/shared/types/ids.types'
import type { DeliveryQueryFilters } from './deliveries.service'

export interface TripQueryFilters {
  empresaId: string
  branchId: BranchId | null
  estado?: TripStatus
  fecha?: string // ISO date exact-match
  vehicleId?: VehicleId
  driverId?: DriverId
}

export type TripSortField = 'fecha' | 'estado'

// Sin deliveryIds a proposito: la asignacion de entregas a una parada
// pasa SIEMPRE por assignDeliveriesToStop (aunque sea la primera vez,
// justo despues de crear el viaje — ver CreateTripModal.tsx), nunca
// pre-cargada aca — es el unico camino que valida techo/capacidad/
// concurrencia (ADR-011 secciones 1/2/3). Si createTrip aceptara
// deliveryIds directo, existirian DOS caminos para asignar una
// entrega a una parada, uno validado y otro no.
export interface CreateTripStopInput {
  clientName: string
  address: string
}

export interface CreateTripInput {
  branchId: BranchId
  vehicleId: VehicleId
  driverId: DriverId
  fecha: string
  paradas: CreateTripStopInput[]
}

export type CreateTripReason = 'vehicle-not-found'

export interface CreateTripResult {
  success: boolean
  trip?: Trip
  reason?: CreateTripReason
}

export type AssignDeliveriesInput =
  | { modo: 'lista'; deliveryIds: DeliveryId[] }
  | { modo: 'filtro'; filtros: Omit<DeliveryQueryFilters, 'empresaId'>; excluidos: DeliveryId[] }

export interface AssignDeliveriesOptions {
  expectedVersion: number
  // Sub-opcion A2 (ADR-011 seccion 2, correccion: motivo obligatorio en
  // el override): sin forzar, una asignacion que excede la capacidad
  // nominal del vehiculo se rechaza entera (ver reason 'exceeds-capacity').
  forzar?: { motivo: string }
}

export type AssignDeliveriesReason =
  'not-found' | 'stale-version' | 'exceeds-limit' | 'exceeds-capacity' | 'motivo-requerido'

export interface AssignDeliveriesConflict {
  deliveryId: DeliveryId
  asignadoATripId: TripId
}

export interface AssignDeliveriesResult {
  success: boolean
  trip?: Trip
  reason?: AssignDeliveriesReason
  matched?: number
  limit?: number
  conflictos?: AssignDeliveriesConflict[]
  asignados?: DeliveryId[]
}

export type TransitionTripReason = 'not-found' | 'invalid-transition'

export interface TransitionTripResult {
  success: boolean
  tripId: string
  previousStatus?: TripStatus
  newStatus?: TripStatus
  reason?: TransitionTripReason
}

export type UpdateStopOrderReason = 'not-found' | 'stops-mismatch'

export interface UpdateStopOrderResult {
  success: boolean
  trip?: Trip
  reason?: UpdateStopOrderReason
}

export type RegisterPodReason = 'not-found' | 'delivery-not-found'

export interface RegisterPodResult {
  success: boolean
  trip?: Trip
  reason?: RegisterPodReason
  // Fase C (hallazgo propio): el intento de marcar la Delivery
  // FINALIZADO puede fallar (ej. todavia esta en CREADO, nunca salio a
  // EN_TRANSITO — transitionDelivery no permite ese salto directo,
  // deliveryStatus.types.ts). El POD en si (evidencia fisica) SI queda
  // registrado igual — es un hecho ya ocurrido, no se descarta por
  // esto (mismo criterio que 'propagation-failed' en
  // deliveries.service.ts#registrarEntrega) — pero `success: true` sin
  // este campo mentiria sobre un efecto que en realidad no se aplico.
  deliveryFinalized: boolean
}

export interface MarkStopNoVisitadaInput {
  motivoCodigo: string
  motivoOtroTexto?: string
  fechaNueva: string // ISO date (yyyy-MM-dd) — proximo intento
}

// Tanda 13 — HALLAZGO ALTO corregido (enmienda ADR-013): antes esta
// funcion no validaba NADA antes de reprogramar — se podia llamar
// sobre una Parada ya 'Visitada' (con POD registrado) o sobre un viaje
// 'Planificado'/'Rendido'/'Cancelado', y devolvia `success: true`
// marcando la Parada 'NoVisitada' aunque TODAS las reprogramaciones de
// sus entregas fallaran. Las 4 primeras razones vienen de
// getStopNoVisitadaBlockReason (unica fuente de la regla, compartida
// con el chequeo client-side de TripDetailPanel.tsx — ver
// shared/utils/stopVisitEligibility.ts); 'reprogram-failed' es nueva:
// si CUALQUIER reprogramDelivery de la Parada falla, la Parada NO se
// marca NoVisitada (ver el comentario en el cuerpo de la funcion sobre
// por que las entregas que SI tuvieron exito no se revierten).
export type MarkStopNoVisitadaReason =
  | 'not-found'
  | 'trip-not-en-curso'
  | 'stop-not-pendiente'
  | 'no-deliveries'
  | 'delivery-en-estado-terminal'
  | 'reprogram-failed'

export interface MarkStopNoVisitadaDeliveryResult {
  deliveryId: DeliveryId
  success: boolean
}

export interface MarkStopNoVisitadaResult {
  success: boolean
  trip?: Trip
  reason?: MarkStopNoVisitadaReason
  resultadosPorEntrega?: MarkStopNoVisitadaDeliveryResult[]
}

export interface TripPositionQueryFilters {
  empresaId: string
  tripId: TripId
}
