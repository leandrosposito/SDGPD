// ============================================================
// SHARED TYPE DEFINITIONS — Cash domain
// ============================================================

export type TransactionType = 'income' | 'expense';
export type TransactionCategory = 'sale' | 'collection' | 'supplier' | 'expense' | 'advance';

export interface CashTransaction {
  id: string;
  time: string;
  type: TransactionType;
  category: TransactionCategory;
  entity?: string; // Nombre del Cliente o Proveedor
  linkedVoucher?: string; // Nro de factura/remito asociado
  description: string;
  amount: number;
}

export interface ExpenseCategoryItem {
  category: string;
  amount: number;
  percentage: number;
}

export interface ExpenseAnalysis {
  trendLabel: string;
  trendPercentage: number;
  isNegativeTrend: boolean; // Si subieron los gastos, es negativo (rojo)
  topCategories: ExpenseCategoryItem[];
}

export interface CashRegister {
  date: string;
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  expenseAnalysis: ExpenseAnalysis;
  transactions: CashTransaction[];
}
