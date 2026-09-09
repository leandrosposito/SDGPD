// ============================================================
// SHARED TYPE DEFINITIONS — Orders domain
//
// Order.id es OrderId y OrderItem.id es OrderLineId (branded types,
// ADR-006/Tanda 5) — OrderItem ES la linea de pedido, no hay un tipo
// separado. Order.clientId es la relacion tipada real hacia
// ClientAccount (AUDIT_4_IDS_RELACIONES.md hallazgo ALTO #1):
// clientName/clientAddress/clientZone se mantienen como snapshot de
// exhibicion historico del pedido (no se borran), pero ahora se
// completan a partir del ClientAccount elegido, no de texto libre.
// ============================================================

import type { OrderId, OrderLineId, ClientId } from './ids.types';

// DEPRECADO (Tanda 9, ADR-010 seccion 1/8): mezcla estado comercial
// (pending/cancelled), logistico (preparing/dispatched/delivered) y
// financiero (invoiced) en una sola columna — AUDIT_15 hallazgo #2.
// Se mantiene de solo lectura (nadie nuevo debe escribirlo) mientras
// convive con `comercial` y las proyecciones derivadas de
// `shared/utils/orderLogistics.ts` — `advanceOrderStatus`/su boton en
// OrdersPage siguen escribiendolo por ahora (ADR-010 seccion 8, punto
// 4: el boton se retira recien cuando TODA la UI que lee `status` haya
// migrado, no antes — esta tanda no migra `OrdersPage`/exports
// todavia, ver el informe de Fase 2).
export type OrderStatus = 'pending' | 'preparing' | 'dispatched' | 'delivered' | 'invoiced' | 'cancelled';

// Eje comercial (ADR-010 seccion 1, Tanda 9): campo REAL, escribible —
// a diferencia del logistico (derivado de Delivery, ver
// shared/utils/orderLogistics.ts#deriveOrderLogisticStatus) y el
// financiero (proyeccion de solo lectura, ver
// deriveOrderFinancialStatus en el mismo archivo), este eje SI se
// persiste porque es un hecho comercial real, no algo que se pueda
// recalcular de otra entidad. Hoy ningun flujo de UI crea pedidos en
// 'Borrador' (CreateOrderModal los crea confirmados) — el valor existe
// en el tipo para cuando haga falta, no es especulativo: ADR-010 lo
// pide explicitamente como uno de los 3 valores del eje.
export type OrderComercialStatus = 'Borrador' | 'Confirmado' | 'Cancelado';

export type OrderSource = 'mobile' | 'manual';
export type PaymentMethod = 'Cuenta Corriente' | 'Efectivo' | 'Transferencia';

export interface OrderHistoryEvent {
  id: string;
  date: string;
  status: OrderStatus;
  description: string;
}

// `quantity` cumple el rol de "cantidadPedida" (ADR-001, Tanda 8) por
// convencion de esta tanda — no se renombra para no forzar un cambio
// masivo en los formularios/mappers de Pedidos ya existentes.
// `cantidadEntregada` es nueva: se acumula con cada remito
// (`registrarEntrega`, deliveries.service.ts) y arranca en 0 para todo
// pedido nuevo. La cantidad pendiente NUNCA se persiste, se deriva
// siempre con `derivePendingQuantity` (shared/utils/orderFulfillment.ts).
export interface OrderItem {
  id: OrderLineId;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  cantidadEntregada: number;
}

export interface Order {
  id: OrderId;
  orderNumber: string;
  date: string;
  clientId: ClientId;
  clientName: string;
  clientAddress: string;
  clientZone: string;
  sellerName: string;
  status: OrderStatus; // deprecado, ver comentario arriba del tipo
  comercial: OrderComercialStatus; // Tanda 9, ADR-010 seccion 1
  source: OrderSource;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  notes: string;
  items: OrderItem[];
  history: OrderHistoryEvent[];
}
