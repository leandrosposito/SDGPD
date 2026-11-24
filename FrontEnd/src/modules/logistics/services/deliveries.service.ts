// ============================================================
// deliveries.service — Acceso a datos de entregas (P1,
// DECISIONES_TECNICAS.md). Pasa por httpClient (Tanda 2.5 de
// escalabilidad): timeout, reintentos, cancelacion real y
// VITE_MOCK_LATENCY_MS/VITE_MOCK_FAILURE_RATE/VITE_API_DEBUG ya no
// son exclusivos de suppliers.service.ts. El servicio hace de
// backend, no de repositorio: filtra, ordena, cuenta y corta el — no
// devuelve el dataset completo para que la vista lo procese.
//
// branchId es un parametro explicito dentro de `filters`, no se lee de
// ningun store (D4/P9): mantiene la capa de datos sin estado global
// oculto. Que el front mande este branchId es una conveniencia de UI,
// no una autorizacion — el backend real debera validar igual que la
// sucursal pedida pertenezca a la empresa de la sesion antes de
// responder.
//
// Tanda 8 (corrida completa, ADR-001/002): agrega la maquina de
// estados tipada (transitionDelivery/reprogramDelivery, reemplazando
// el advanceDeliveryStatus lineal de antes) y los remitos
// (registrarEntrega) — ver ADR-001/ADR-002 completos en docs/adr/.
// ============================================================

export {
  getOrderBranchLinksForAggregation,
  getActiveDeliveriesForOrder,
  getDeliveryById,
  getDeliveryIdsMatchingFilter,
  getDeliveryNotesForDelivery,
} from './deliveries.lookups'
export { toISODate } from './deliveries.scope'
export {
  getDeliveriesPage,
  exportDeliveries,
  getDeliveriesForOrder,
  getDeliveriesByIds,
} from './deliveries.queries'
export { transitionDelivery, reprogramDelivery } from './deliveries.transitions'
export { registrarEntrega, createDelivery } from './deliveries.fulfillment'

export type {
  DeliveryQueryFilters,
  DeliverySortField,
  DeliveryAggregates,
  DeliveryTransitionReason,
  DeliveryTransitionResult,
  ReprogramDeliveryInput,
  ReprogramDeliveryReason,
  ReprogramDeliveryResult,
  RegistrarEntregaLineInput,
  RegistrarEntregaReason,
  RegistrarEntregaResult,
  CreateDeliveryInput,
  CreateDeliveryReason,
  CreateDeliveryResult,
} from './deliveries.types'
