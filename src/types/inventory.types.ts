// ============================================================
// SHARED TYPE DEFINITIONS — Inventory domain
// ============================================================

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
}
