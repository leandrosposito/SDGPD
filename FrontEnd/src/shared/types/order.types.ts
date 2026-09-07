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

export type OrderStatus = 'pending' | 'preparing' | 'dispatched' | 'delivered' | 'invoiced' | 'cancelled';
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
  status: OrderStatus;
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
