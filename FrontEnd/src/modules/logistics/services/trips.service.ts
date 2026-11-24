// ============================================================
// trips.service — Viajes, asignacion y POD (Tanda 10B, ADR-011).
// Alcance SUCURSAL: branchId obligatorio en getTripsPage y presente en
// Trip.branchId — mismo criterio que deliveries.service.ts.
//
// Limitacion conocida (documentada, no oculta): ni Order ni Delivery
// modelan hoy peso/volumen/bultos por producto — no existe ese dato en
// el dominio todavia. capacidadUsada.bultos se calcula server-side
// como la CANTIDAD DE ENTREGAS asignadas al viaje (un hecho real y
// contable), pesoKg/volumenM3 quedan en 0 (no hay de donde derivarlos
// honestamente hoy) — el chequeo de sobrecarga (ADR-011 seccion 2) solo
// puede evaluar la dimension bultos hasta que el dominio de
// productos/pedidos modele peso/volumen.
// ============================================================

export {
  getTripsPage,
  getTripById,
  getTripPosition,
  getTripRoute,
  MAX_ROUTE_POINTS,
} from './trips.queries'
export { createTrip, transitionTrip, updateStopOrder } from './trips.lifecycle'
export {
  assignDeliveriesToStop,
  releaseDeliveryFromTrip,
  MAX_TRIP_ASSIGNMENT,
} from './trips.assignment'
export { registerPod, markStopNoVisitada } from './trips.stops'

export type {
  TripQueryFilters,
  TripSortField,
  CreateTripStopInput,
  CreateTripInput,
  CreateTripReason,
  CreateTripResult,
  AssignDeliveriesInput,
  AssignDeliveriesOptions,
  AssignDeliveriesReason,
  AssignDeliveriesConflict,
  AssignDeliveriesResult,
  TransitionTripReason,
  TransitionTripResult,
  UpdateStopOrderReason,
  UpdateStopOrderResult,
  RegisterPodReason,
  RegisterPodResult,
  MarkStopNoVisitadaInput,
  MarkStopNoVisitadaReason,
  MarkStopNoVisitadaDeliveryResult,
  MarkStopNoVisitadaResult,
  TripPositionQueryFilters,
} from './trips.types'
