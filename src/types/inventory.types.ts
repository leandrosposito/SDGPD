// ============================================================
// SHARED TYPE DEFINITIONS — Inventory domain
// ============================================================

export interface ProductLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expirationDate: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  wholesaleMargin?: number;
  distributorMargin?: number;
  retailMargin?: number;
  lots?: ProductLot[];
}

export interface ProductHistoryEvent {
  id: string;
  date: string;
  sku: string;
  productName: string;
  eventType: string;
  description: string;
  user: string;
}

export interface InventoryMovement {
  id: string;
  date: string;
  sku: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  user: string;
  notes: string;
}

export interface PurchaseSuggestion {
  id: string;
  sku: string;
  productName: string;
  supplierName: string;
  currentStock: number;
  minStock: number;
  suggestedQuantity: number;
  estimatedCost: number;
}

export interface InventoryData {
  items: InventoryItem[];
  movements: InventoryMovement[];
  suggestions: PurchaseSuggestion[];
  history: ProductHistoryEvent[];
}
