import type { PurchaseSuggestion } from '@/shared/types/inventory.types';
import { asBranchId } from '@/shared/types/ids.types';
import type { PurchaseSuggestionDTO } from './dto';

// ============================================================
// mapper.ts (purchase-suggestions) — Único lugar que traduce
// DTO↔dominio. Nada fuera de `purchase-suggestions.service.ts` lo
// importa. `productId` NO se brandea (`InventoryItem['id']` sigue
// siendo `string` plano hoy, confirmado en `inventory.types.ts` —
// ADR-006 no llegó a `ProductId` todavía, se deja tal cual, no se le
// inventa un branded type nuevo fuera de esa migración incremental).
// ============================================================

export function purchaseSuggestionFromDTO(dto: PurchaseSuggestionDTO): PurchaseSuggestion {
  return {
    id: dto.id,
    productId: dto.producto_id,
    sku: dto.sku,
    productName: dto.nombre_producto,
    supplierName: dto.nombre_proveedor,
    branchId: asBranchId(dto.sucursal_id),
    currentStock: dto.stock_actual,
    minStock: dto.stock_minimo,
    suggestedQuantity: dto.cantidad_sugerida,
    estimatedCost: dto.costo_estimado,
  };
}

// Usada solo para sembrar el store desde data/mock/inventory.data.ts
// (dominio) — un backend real nunca la necesitaría.
export function purchaseSuggestionToDTO(item: PurchaseSuggestion): PurchaseSuggestionDTO {
  return {
    id: item.id,
    producto_id: item.productId,
    sku: item.sku,
    nombre_producto: item.productName,
    nombre_proveedor: item.supplierName,
    sucursal_id: item.branchId,
    stock_actual: item.currentStock,
    stock_minimo: item.minStock,
    cantidad_sugerida: item.suggestedQuantity,
    costo_estimado: item.estimatedCost,
  };
}
