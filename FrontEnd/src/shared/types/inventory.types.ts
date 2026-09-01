// ============================================================
// SHARED TYPE DEFINITIONS — Inventory domain
// ============================================================

import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';

export interface ProductLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expirationDate: string;
}

// RF-INV-002 (Inventario multi-sucursal): el stock es una entidad aparte
// de InventoryItem, no un array embebido en el producto. Ver
// DECISIONES_TECNICAS.md, E1, para el razonamiento completo (catalogo vs.
// stock tienen ciclos de vida y volumenes distintos; con 50.000 productos
// x 40 sucursales embeber el stock en el producto arrastraria 2.000.000
// de filas solo para pedir el catalogo).
export interface ProductStock {
  productId: InventoryItem['id'];
  branchId: Branch['id'];
  stock: number;
  minStock: number;
}

// Vista compuesta para pantallas que muestran un producto junto con su
// stock en la sucursal activa (ver products.service#getStockedProductsForBranch/
// getLowStockForBranch). No es un tipo nuevo de dominio, es la forma que
// consumen las tabs de inventory que hoy leian stock/minStock directo de
// InventoryItem.
export type StockedInventoryItem = InventoryItem & ProductStock;

// NOTA: InventoryItem mezcla datos de mas de un RF del Doc 04 porque el codigo
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

  // --- RF-INV-001 (Inventario): reposicion — fuera de alcance de RF-PRD-001 ---
  // supplierId: referencia tipada (import de solo tipo, sin import runtime
  // entre modulos), mismo patron que Delivery.orderId: Order['id']. Antes
  // era `supplier: string` con el NOMBRE del proveedor — anti-patron ya
  // senalado en DECISIONES_TECNICAS.md, Opcion A ahora implementada (E3).
  supplierId: Supplier['id'];
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
  // productId (O9, DECISIONES_TECNICAS.md): referencia tipada al
  // producto real (InventoryItem), agregada para poder resolver su
  // supplierId al generar una OC — "Generar OC" nunca debe resolver el
  // proveedor por `supplierName` (texto libre, puede no coincidir con
  // ningun Supplier real), siempre por ID (R2).
  productId: InventoryItem['id'];
  sku: string;
  productName: string;
  // supplierName es SOLO de exhibicion (columna "Proveedor" de la
  // tabla) — nunca se usa para resolver el proveedor real al generar
  // la OC, ver TabPurchases.tsx.
  supplierName: string;
  // La sugerencia de compra ahora es por sucursal (E1: el stock que la
  // origina es de sucursal, no del producto).
  branchId: Branch['id'];
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

// Estado de una solicitud de reposicion sobre un producto bajo stock
// minimo. Nombre generico (no "InventoryReplenishmentStatus"): hoy vive
// en este archivo por ser el unico dominio que lo usa, pero el concepto
// no es exclusivo de inventory — pensado para el futuro vinculo con
// suppliers (ver DECISIONES_TECNICAS.md).
export type ReplenishmentStatus = 'not_requested' | 'requested';
