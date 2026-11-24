import type { Delivery, DeliveryStatus } from '@/shared/types/logistics.types'
import type { Branch } from '@/shared/types/session.types'
import type { OrderLineId, TripId, StopId } from '@/shared/types/ids.types'
import type { DeliveryNote } from '@/shared/types/deliveryNote.types'
import type { MotivoTipo } from '@/shared/types/motivo.types'
import type { DateRangeQueryFilters } from '@/shared/types/pagination.types'

// date (un solo dia, exact-match) paso a ser dateFrom/dateTo (rango,
// DateRangeFilter — tarea transversal): LogisticsPage sigue usando
// "Hoy" como default (dateFrom=dateTo=hoy es equivalente al viejo
// comportamiento fijo), pero ahora el usuario puede elegir otro rango.
export interface DeliveryQueryFilters extends DateRangeQueryFilters {
  // Regla 3.5 del protocolo: toda funcion de service lleva empresaId
  // explicito (AUDIT_2026-09-08_empresaId-sweep.md) — faltaba en las 6
  // funciones de este archivo, corregido en este lote.
  empresaId: string
  // null solo mientras activeBranchId todavia no cargo — LogisticsPage
  // pasa `enabled: activeBranchId !== null` a usePagedQuery para ese
  // caso, asi que matchesScope nunca ve null en la practica (Tanda 5,
  // ADR-006: branding de BranchId no permite un placeholder '' valido).
  branchId: Branch['id'] | null
  // undefined = todos los estados (filtro "Todas" en DeliveryFilters).
  status?: DeliveryStatus
}

export type DeliverySortField = 'estimatedTime' | 'collectionAmount' | 'clientName'

// Agregados de logistica (P3): calculados sobre TODO lo que matchea
// fecha+sucursal, sin aplicar el filtro de estado — asi los contadores
// de DeliveryFilters y los KPIs de LogisticsKPIs no cambian segun cual
// estado este seleccionado (mismo comportamiento que tenia la pantalla
// antes de paginar: los KPIs y los contadores por estado siempre
// reflejaban "hoy, esta sucursal", no el subconjunto ya filtrado).
export interface DeliveryAggregates {
  countByStatus: Record<DeliveryStatus, number>
  // Igual a la suma de countByStatus, pero ya resuelta aca: ningun
  // componente debe sumarla (P3), ni siquiera un total tan trivial.
  totalForScope: number
  pendingCollectionAmount: number
}

export type DeliveryTransitionReason = 'not-found' | 'invalid-transition'

export interface DeliveryTransitionResult {
  success: boolean
  deliveryId: string
  previousStatus?: DeliveryStatus
  newStatus?: DeliveryStatus
  reason?: DeliveryTransitionReason
}

export interface ReprogramDeliveryInput {
  fechaNueva: string // ISO date (yyyy-MM-dd)
  // Tanda 11 (ADR-013): motivo de texto libre -> catalogo, mismo
  // patron que RegistrarEntregaLineInput/'rechazo'. motivoTipo decide
  // contra que catalogo se resuelve — la misma funcion sirve tanto a
  // ReprogramarModal ('reprogramacion') como al flujo de "entrega no
  // realizada" de trips.service.ts#markStopNoVisitada ('no-entrega').
  motivoCodigo: string
  motivoOtroTexto?: string
  motivoTipo: MotivoTipo
  responsable: string
  // Tanda 13 (hallazgo propio, enmienda ADR-013): trazabilidad — solo
  // trips.service.ts#markStopNoVisitada los pasa (la reprogramacion
  // nace de intentar marcar esa Parada como no visitada);
  // ReprogramarModal.tsx nunca los pasa (reprogramacion
  // "administrativa", sin viaje en curso). Ver ReprogramacionEvent en
  // logistics.types.ts para el razonamiento completo.
  tripId?: TripId
  stopId?: StopId
}

export type ReprogramDeliveryReason = 'not-found' | 'invalid-transition' | 'motivo-invalido'

export interface ReprogramDeliveryResult {
  success: boolean
  deliveryId: string
  reason?: ReprogramDeliveryReason
}

export interface RegistrarEntregaLineInput {
  orderLineId: OrderLineId
  cantidadEntregada: number
  cantidadRechazada: number
  // Tanda 9 (ADR-010 seccion 5): reemplaza al motivoRechazo de texto
  // libre — motivoCodigo referencia MotivoCatalogItem.codigo ('OTRO'
  // incluido). motivoOtroTexto solo se usa/exige cuando el codigo es
  // 'OTRO'.
  motivoCodigo?: string
  motivoOtroTexto?: string
}

export type RegistrarEntregaReason =
  'not-found' | 'invalid-transition' | 'no-lines' | 'motivo-invalido' | 'propagation-failed'

export interface RegistrarEntregaResult {
  success: boolean
  note?: DeliveryNote
  reason?: RegistrarEntregaReason
}

export interface CreateDeliveryInput {
  branchId: Branch['id']
  date: string // ISO date (yyyy-MM-dd)
  estimatedTime: string
  zone: 'Norte' | 'Centro' | 'Sur'
  priority: 'high' | 'medium' | 'low'
  collectionAmount: number
}

export type CreateDeliveryReason = 'order-not-found' | 'order-not-confirmado'

export interface CreateDeliveryResult {
  success: boolean
  delivery?: Delivery
  reason?: CreateDeliveryReason
}
