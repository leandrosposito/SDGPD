import type { Order, OrderStatus } from '@/shared/types/order.types'
import type { OrderLineId } from '@/shared/types/ids.types'
import type { DateRangeQueryFilters } from '@/shared/types/pagination.types'
import type { CreateOrderReason } from '@/shared/utils/orderEligibility'

export interface OrdersQueryFilters extends DateRangeQueryFilters {
  // Todo método de este service recibe empresaId explícito desde
  // ahora (mismo criterio que suppliers/products/clients) — hoy el
  // mock no filtra por él de verdad (una sola empresa), pero el
  // contrato ya lo exige para el día que exista backend real.
  empresaId: string
  search?: string
  status?: OrderStatus
  seller?: string
  paymentMethod?: string
}

export type OrdersSortField = 'date' | 'totalAmount' | 'clientName'

// Agregados (P3, DECISIONES_TECNICAS.md): reemplaza el cálculo que
// hacía OrderKpis.tsx en memoria sobre el array completo de pedidos —
// una vez paginado, ese array pasa a ser solo la página actual, así
// que el cálculo tiene que vivir server-side. Se calculan sobre el
// scope filtrado por búsqueda/vendedor/forma de pago/fecha, SIN el
// filtro de estado (mismo criterio que PurchaseOrdersAggregates/
// DeliveryAggregates: la faceta que el usuario togglea no debe
// cambiar los totales de las otras facetas). Antes de esta tanda,
// OrderKpis ignoraba TODOS los filtros (siempre mostraba el total de
// la empresa); esto es una alineación consciente con la convención ya
// establecida en el resto del proyecto, no un cambio accidental.
export interface OrdersAggregates {
  todayCount: number
  pendingCount: number
  preparingCount: number
  dispatchedCount: number
  todayBilling: number
}

export type CreateOrderResult =
  { success: true; order: Order } | { success: false; reason: CreateOrderReason; detail?: string }

// 'has-active-deliveries'/'invalid-status-for-cancel' solo los produce
// cancelOrder — advanceOrderStatus nunca los devuelve, pero comparten
// el mismo tipo de resultado (OrderStatusTransitionResult) desde antes
// de este fix, no vale la pena partirlo en dos tipos. 'invalid-status-
// for-cancel' es DISTINTO de 'terminal-status' (el que ya usa
// advanceOrderStatus): 'terminal-status' significa "no hay siguiente
// paso en ORDER_STATUS_FLOW" (invoiced/cancelled) — 'delivered' SI
// tiene siguiente paso ahi (fluye a invoiced), pero igual esta
// prohibido CANCELAR un pedido ya entregado (regla de negocio propia
// de cancelar, no de avanzar).
export type OrderStatusTransitionReason =
  'not-found' | 'terminal-status' | 'has-active-deliveries' | 'invalid-status-for-cancel'

export interface OrderStatusTransitionResult {
  success: boolean
  orderId: string
  previousStatus?: OrderStatus
  newStatus?: OrderStatus
  reason?: OrderStatusTransitionReason
}

export interface OrderLineDeliveryDelta {
  orderLineId: OrderLineId
  cantidadEntregada: number
}
