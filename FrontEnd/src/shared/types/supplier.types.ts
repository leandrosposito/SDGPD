// ============================================================
// SHARED TYPE DEFINITIONS — Supplier domain
// ============================================================

export interface SupplierProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  cost: number;
  lastUpdate: string;
}

export interface SupplierPurchaseOrder {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
}

export interface Supplier {
  id: string;
  name: string;
  cuit: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  address: string;
  city: string;
  paymentTerms: string;
  category: string;
  pendingOrdersCount: number;
  daysUntilExpiration: number | null;
  currentBalance: number;
  hasOverdueDebt: boolean;
  products: SupplierProduct[];
  purchaseOrders: SupplierPurchaseOrder[];
}
