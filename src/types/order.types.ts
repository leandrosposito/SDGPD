// ============================================================
// SHARED TYPE DEFINITIONS — Orders domain
// ============================================================

export type OrderStatus = 'pending' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';
export type OrderSource = 'mobile' | 'manual';

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
  totalAmount: number;
  notes: string;
  items: OrderItem[];
}
