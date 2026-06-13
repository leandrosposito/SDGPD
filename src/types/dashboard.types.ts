// ============================================================
// SHARED TYPE DEFINITIONS — Dashboard domain
// ============================================================

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  delta: number;       // percentage change vs previous period
  deltaLabel: string;
  trend: 'up' | 'down' | 'neutral';
  prefix?: string;
  suffix?: string;
}

export interface SalesDataPoint {
  month: string;
  revenue: number;
  orders: number;
  returns: number;
}

export interface TopProduct {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  zone: string;
  totalAmount: number;
  itemCount: number;
  status: 'pending' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';
  createdAt: string;
}

export interface DashboardData {
  kpis: KpiMetric[];
  salesSeries: SalesDataPoint[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
}
