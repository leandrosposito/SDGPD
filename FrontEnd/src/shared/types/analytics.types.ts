// ============================================================
// SHARED TYPE DEFINITIONS — Analytics domain
// ============================================================

export type TimePeriod = 'today' | 'week' | 'month' | 'year';

export interface KpiData {
  monthlyRevenue: number;
  growthPercent: number;
  deliveredOrders: number;
  totalDebt: number;
}

export interface SalesDataPoint {
  label: string;
  revenue: number;
}

export interface TopProduct {
  sku: string;
  name: string;
  units: number;
  revenue: number;
}

export interface CashFlowData {
  income: number;
  expenses: number;
}

export interface TopDebtor {
  id: string;
  clientName: string;
  zone: string;
  balance: number;
  overdueAmount: number;
  isOverdue: boolean;
}

export interface AnalyticsPeriodData {
  kpis: KpiData;
  salesTrend: SalesDataPoint[];
  topProducts: TopProduct[];
  cashFlow: CashFlowData;
  topDebtors: TopDebtor[];
}
