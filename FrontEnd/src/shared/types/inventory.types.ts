// ============================================================
// SHARED TYPE DEFINITIONS — Inventory domain
// ============================================================

export interface ProductLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expirationDate: string;
}

// NOTA (C1/C5 — docs/implementacion/CONTRADICCIONES.md):
// InventoryItem mezcla datos de mas de un RF del Doc 04 porque el codigo
// unifico visualmente "Productos" e "Inventario" en un unico modulo. No se
// separa la interfaz para no romper a los consumidores existentes; en su
// lugar cada grupo de campos se anota con el RF al que pertenece.
export interface InventoryItem {
  // --- RF-PRD-001 (Maestro de Productos): datos maestros del articulo ---
  id: string;
  sku: string;
  barcode: string; // EAN-13
  name: string;
  description?: string;
  category: string; // referencia a categoria por nombre; RF-CAT-001 (pendiente) definira el arbol real
  unitOfMeasure: string; // Unidad de Medida Base (RF-PRD-004 definira conversiones UM)
  status: 'active' | 'inactive';

  // --- RF-INV-001 (Inventario): stock y reposicion — fuera de alcance de RF-PRD-001 ---
  supplier: string;
  stock: number;
  minStock: number;
  lots?: ProductLot[];

  // --- RF-PRI-001 (Precios): costo y margenes — fuera de alcance de RF-PRD-001 ---
  cost: number;
  price: number;
  wholesaleMargin?: number;
  distributorMargin?: number;
  retailMargin?: number;
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
