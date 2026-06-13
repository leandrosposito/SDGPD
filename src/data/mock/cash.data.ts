import type { CashRegister } from '../../types/cash.types';

export const CASH_MOCK_DATA: CashRegister = {
  date: '2026-06-13',
  initialBalance: 50000,
  totalIncome: 120000,
  totalExpense: 35000,
  currentBalance: 135000,
  transactions: [
    {
      id: 'ctx-001',
      time: '08:45:00',
      type: 'income',
      category: 'sale',
      description: 'Venta mostrador - Ticket 001',
      amount: 15000,
    },
    {
      id: 'ctx-002',
      time: '09:30:00',
      type: 'expense',
      category: 'supplier',
      description: 'Pago proveedor (Coca-Cola)',
      amount: 25000,
    },
    {
      id: 'ctx-003',
      time: '10:15:00',
      type: 'income',
      category: 'collection',
      description: 'Cobranza factura - Kiosco El Paso',
      amount: 105000,
    },
    {
      id: 'ctx-004',
      time: '11:00:00',
      type: 'expense',
      category: 'expense',
      description: 'Gastos de libreria',
      amount: 10000,
    },
  ],
};
