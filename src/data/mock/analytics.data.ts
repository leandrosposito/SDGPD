import type { TimePeriod, AnalyticsPeriodData } from '../../types/analytics.types';

// ============================================================
// MOCK DATA — Analytics (indexed by TimePeriod)
// ============================================================

export const ANALYTICS_DATA: Record<TimePeriod, AnalyticsPeriodData> = {
  today: {
    kpis: {
      monthlyRevenue: 47250,
      growthPercent: 3.1,
      deliveredOrders: 6,
      totalDebt: 305000,
    },
    salesTrend: [
      { label: '08:00', revenue: 8200 },
      { label: '10:00', revenue: 15400 },
      { label: '12:00', revenue: 22100 },
      { label: '14:00', revenue: 28700 },
      { label: '16:00', revenue: 39500 },
      { label: '18:00', revenue: 47250 },
    ],
    topProducts: [
      { sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', units: 60,  revenue: 126000 },
      { sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg',   units: 18,  revenue:  64800 },
      { sku: 'GAL-SUR-200', name: 'Galletitas 200g',    units: 55,  revenue:  24750 },
      { sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml',  units: 6,   revenue:  33600 },
      { sku: 'YER-UNI-05', name: 'Yerba Union 500g',    units: 23,  revenue:  34960 },
    ],
    cashFlow: { income: 47250, expenses: 9500 },
    topDebtors: [
      { id: 'td-1', clientName: 'Las Marias S.A.C.I.',  zone: 'Proveedor', balance: 210000, overdueAmount: 210000, isOverdue: true },
      { id: 'td-2', clientName: 'Almacen La Esquina',   zone: 'Norte',     balance: 50000,  overdueAmount: 0,      isOverdue: false },
    ],
  },

  week: {
    kpis: {
      monthlyRevenue: 318900,
      growthPercent: 8.4,
      deliveredOrders: 34,
      totalDebt: 305000,
    },
    salesTrend: [
      { label: 'Lun', revenue: 42100 },
      { label: 'Mar', revenue: 55300 },
      { label: 'Mie', revenue: 48700 },
      { label: 'Jue', revenue: 61200 },
      { label: 'Vie', revenue: 72400 },
      { label: 'Sab', revenue: 39200 },
    ],
    topProducts: [
      { sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', units: 420, revenue: 882000 },
      { sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg',   units: 126, revenue: 453600 },
      { sku: 'GAL-SUR-200', name: 'Galletitas 200g',    units: 385, revenue: 173250 },
      { sku: 'YER-UNI-05', name: 'Yerba Union 500g',    units: 161, revenue: 244720 },
      { sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml',  units: 42,  revenue: 235200 },
    ],
    cashFlow: { income: 318900, expenses: 95000 },
    topDebtors: [
      { id: 'td-1', clientName: 'Las Marias S.A.C.I.',  zone: 'Proveedor', balance: 210000, overdueAmount: 210000, isOverdue: true },
      { id: 'td-2', clientName: 'Almacen La Esquina',   zone: 'Norte',     balance: 50000,  overdueAmount: 0,      isOverdue: false },
      { id: 'td-3', clientName: 'Maxikiosco Norte',     zone: 'Norte',     balance: 45000,  overdueAmount: 45000,  isOverdue: true },
    ],
  },

  month: {
    kpis: {
      monthlyRevenue: 1240500,
      growthPercent: 12.7,
      deliveredOrders: 142,
      totalDebt: 305000,
    },
    salesTrend: [
      { label: 'Ene', revenue: 890000 },
      { label: 'Feb', revenue: 970000 },
      { label: 'Mar', revenue: 1050000 },
      { label: 'Abr', revenue: 1100000 },
      { label: 'May', revenue: 1098000 },
      { label: 'Jun', revenue: 1240500 },
    ],
    topProducts: [
      { sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', units: 1800, revenue: 3780000 },
      { sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg',   units: 540,  revenue: 1944000 },
      { sku: 'GAL-SUR-200', name: 'Galletitas 200g',    units: 1650, revenue:  742500 },
      { sku: 'YER-UNI-05', name: 'Yerba Union 500g',    units: 690,  revenue: 1048800 },
      { sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml',  units: 180,  revenue: 1008000 },
    ],
    cashFlow: { income: 1240500, expenses: 408000 },
    topDebtors: [
      { id: 'td-1', clientName: 'Las Marias S.A.C.I.',  zone: 'Proveedor', balance: 210000, overdueAmount: 210000, isOverdue: true },
      { id: 'td-2', clientName: 'Supermercado Lider',   zone: 'Centro',    balance: 120000, overdueAmount: 0,      isOverdue: false },
      { id: 'td-3', clientName: 'Almacen La Esquina',   zone: 'Norte',     balance: 50000,  overdueAmount: 0,      isOverdue: false },
      { id: 'td-4', clientName: 'Maxikiosco Norte',     zone: 'Norte',     balance: 45000,  overdueAmount: 45000,  isOverdue: true },
    ],
  },

  year: {
    kpis: {
      monthlyRevenue: 13850000,
      growthPercent: 21.3,
      deliveredOrders: 1640,
      totalDebt: 305000,
    },
    salesTrend: [
      { label: 'Jul 25', revenue: 850000  },
      { label: 'Ago 25', revenue: 920000  },
      { label: 'Sep 25', revenue: 980000  },
      { label: 'Oct 25', revenue: 1050000 },
      { label: 'Nov 25', revenue: 1120000 },
      { label: 'Dic 25', revenue: 1380000 },
      { label: 'Ene 26', revenue: 890000  },
      { label: 'Feb 26', revenue: 970000  },
      { label: 'Mar 26', revenue: 1050000 },
      { label: 'Abr 26', revenue: 1100000 },
      { label: 'May 26', revenue: 1098000 },
      { label: 'Jun 26', revenue: 1240500 },
    ],
    topProducts: [
      { sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', units: 21600, revenue: 45360000 },
      { sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg',   units: 6480,  revenue: 23328000 },
      { sku: 'GAL-SUR-200', name: 'Galletitas 200g',    units: 19800, revenue:  8910000 },
      { sku: 'YER-UNI-05', name: 'Yerba Union 500g',    units: 8280,  revenue: 12585600 },
      { sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml',  units: 2160,  revenue: 12096000 },
    ],
    cashFlow: { income: 13850000, expenses: 4900000 },
    topDebtors: [
      { id: 'td-1', clientName: 'Las Marias S.A.C.I.',  zone: 'Proveedor', balance: 210000, overdueAmount: 210000, isOverdue: true },
      { id: 'td-2', clientName: 'Supermercado Lider',   zone: 'Centro',    balance: 120000, overdueAmount: 0,      isOverdue: false },
      { id: 'td-3', clientName: 'Almacen La Esquina',   zone: 'Norte',     balance: 50000,  overdueAmount: 0,      isOverdue: false },
      { id: 'td-4', clientName: 'Maxikiosco Norte',     zone: 'Norte',     balance: 45000,  overdueAmount: 45000,  isOverdue: true },
    ],
  },
};
