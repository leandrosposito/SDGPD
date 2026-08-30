// ============================================================
// SHARED TYPE DEFINITIONS — Logistics domain
// ============================================================

import type { Order } from './order.types';

export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered';

export interface Delivery {
  id: string;
  orderId: Order['id'];
  clientName: string;
  address: string;
  date: string; // ISO date (yyyy-MM-dd) — dia de la entrega
  estimatedTime: string; // ventana horaria estimada, ej. "09:00 - 11:00"
  status: DeliveryStatus;
  zone: 'Norte' | 'Centro' | 'Sur';
  priority: 'high' | 'medium' | 'low';
  collectionAmount: number;
}
