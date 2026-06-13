// ============================================================
// SHARED TYPE DEFINITIONS — Client domain
// ============================================================

export interface ClientTransaction {
  id: string;
  date: string;
  type: 'invoice' | 'payment' | 'adjustment';
  description: string;
  debit: number; // Debe (Aumenta deuda)
  credit: number; // Haber (Reduce deuda)
  balance: number; // Saldo
}

export interface ClientAccount {
  id: string;
  clientName: string;
  zone: string;
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
  transactions: ClientTransaction[];
}
