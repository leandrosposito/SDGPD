// ============================================================
// SHARED TYPE DEFINITIONS — Cash domain
// ============================================================

export interface CashTransaction {
  id: string;
  time: string;
  type: 'income' | 'expense';
  category: 'sale' | 'collection' | 'supplier' | 'expense';
  description: string;
  amount: number;
}

export interface CashRegister {
  date: string;
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  transactions: CashTransaction[];
}
