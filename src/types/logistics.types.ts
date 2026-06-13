// ============================================================
// SHARED TYPE DEFINITIONS — Logistics domain
// ============================================================

export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered';

export interface LogisticsOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  address: string;
  status: DeliveryStatus;
  zone: 'Norte' | 'Centro' | 'Sur';
}
