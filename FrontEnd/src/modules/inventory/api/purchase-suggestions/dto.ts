// ============================================================
// dto.ts (purchase-suggestions) — Forma que tendría la respuesta de un
// backend real (Tanda 3f de escalabilidad, cierra la migración de
// Reposición). Mismo criterio que `movements/dto.ts` (Tanda 3g):
// snake_case, deliberadamente distinta del tipo de dominio
// (`shared/types/inventory.types.ts#PurchaseSuggestion`).
//
// UBICACIÓN: `modules/inventory/api/purchase-suggestions/`, no
// `shared/api/` — dominio EXCLUSIVO de `inventory` (mismo motivo que
// `movements`/`product-history`, ver DECISIONES_TECNICAS.md entrada de
// Tanda 3g): `PurchaseSuggestion` solo aparece en `inventory.types.ts`
// y `TabPurchases.tsx`.
// ============================================================

export interface PurchaseSuggestionDTO {
  id: string;
  producto_id: string;
  sku: string;
  nombre_producto: string;
  nombre_proveedor: string;
  sucursal_id: string;
  stock_actual: number;
  stock_minimo: number;
  cantidad_sugerida: number;
  costo_estimado: number;
}

export interface PurchaseSuggestionsPageDTO {
  data: PurchaseSuggestionDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}
