import type { CashRegister } from '@/shared/types/cash.types';

export const CASH_MOCK_DATA: CashRegister = {
  date: '2026-06-14',
  initialBalance: 50000,
  totalIncome: 180000,
  totalExpense: 60000,
  currentBalance: 170000,
  expenseAnalysis: {
    trendLabel: 'vs mes anterior',
    trendPercentage: 20,
    isNegativeTrend: true, // +20% gastos es malo (rojo)
    topCategories: [
      { category: 'Combustible', amount: 30000, percentage: 50 },
      { category: 'Mantenimiento', amount: 20000, percentage: 33 },
      { category: 'Servicios', amount: 10000, percentage: 17 },
    ],
  },
  transactions: [
    {
      id: 'ctx-001',
      time: '08:45:00',
      type: 'income',
      category: 'sale',
      entity: 'Mostrador',
      description: 'Venta minorista',
      amount: 15000,
    },
    {
      id: 'ctx-002',
      time: '09:30:00',
      type: 'expense',
      category: 'supplier',
      entity: 'Distribuidora Coca-Cola',
      linkedVoucher: 'FAC-0012-A',
      description: 'Pago semanal de bebidas',
      amount: 25000,
    },
    {
      id: 'ctx-003',
      time: '10:15:00',
      type: 'income',
      category: 'collection',
      entity: 'Kiosco El Paso',
      linkedVoucher: 'PED-00385',
      description: 'Cobro de cuenta corriente',
      amount: 105000,
    },
    {
      id: 'ctx-004',
      time: '11:00:00',
      type: 'expense',
      category: 'expense',
      entity: 'Papelera San Martin',
      description: 'Insumos de oficina',
      amount: 10000,
    },
    {
      id: 'ctx-005',
      time: '12:30:00',
      type: 'income',
      category: 'advance',
      entity: 'Supermercado Lider',
      description: 'Anticipo para pedido especial',
      amount: 60000,
    },
    {
      id: 'ctx-006',
      time: '14:00:00',
      type: 'expense',
      category: 'advance',
      entity: 'Transportes Express',
      description: 'Adelanto de flete',
      amount: 25000,
    },
  ],
};

// Mock data para el selector de facturas pendientes en el modal dinámico
export const PENDING_VOUCHERS_MOCK: Record<string, { id: string; label: string; amount: number }[]> = {
  'Kiosco El Paso': [
    { id: 'FAC-0089', label: 'Factura A 0089', amount: 45000 },
    { id: 'PED-00385', label: 'Pedido Pendiente 00385', amount: 60000 },
  ],
  'Distribuidora Coca-Cola': [
    { id: 'FAC-0012-A', label: 'Factura A 0012', amount: 25000 },
  ]
};
