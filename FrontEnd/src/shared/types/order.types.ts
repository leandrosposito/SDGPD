// ============================================================
// SHARED TYPE DEFINITIONS — Orders domain
// ============================================================

export type OrderStatus = 'pending' | 'preparing' | 'dispatched' | 'delivered' | 'invoiced' | 'cancelled';
export type OrderSource = 'mobile' | 'manual';
export type PaymentMethod = 'Cuenta Corriente' | 'Efectivo' | 'Transferencia';

export interface OrderHistoryEvent {
  id: string;
  date: string;
  status: OrderStatus;
  description: string;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
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
