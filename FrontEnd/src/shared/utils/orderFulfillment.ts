import type { OrderItem } from '@/shared/types/order.types';

// ============================================================
// orderFulfillment — ADR-001 (Tanda 8, corrida completa): la cantidad
// pendiente y el estado de cumplimiento de un pedido NUNCA se
// persisten, se derivan siempre a partir de las lineas
// (quantity = cantidadPedida, cantidadEntregada acumulada por los
// remitos ya aplicados) — mismo principio que `computePurchaseOrderTotal`
// ya aplica al total de una OC (nunca persistido, siempre derivado).
// ============================================================

export type OrderFulfillmentStatus = 'pendiente' | 'parcial' | 'completo';

type FulfillmentLine = Pick<OrderItem, 'quantity' | 'cantidadEntregada'>;

// Clampeada a 0: nunca deberia haber mas entregado que pedido, pero un
// ajuste manual futuro (fuera de alcance de esta tanda) podria dejar
// `cantidadEntregada` momentaneamente por encima — la cantidad
// pendiente jamas debe mostrarse negativa.
export function derivePendingQuantity(item: FulfillmentLine): number {
  return Math.max(0, item.quantity - item.cantidadEntregada);
}

export function deriveOrderFulfillmentStatus(items: FulfillmentLine[]): OrderFulfillmentStatus {
  if (items.length === 0) return 'pendiente';

  const allComplete = items.every((item) => item.cantidadEntregada >= item.quantity);
  if (allComplete) return 'completo';

  const anyDelivered = items.some((item) => item.cantidadEntregada > 0);
  return anyDelivered ? 'parcial' : 'pendiente';
}
