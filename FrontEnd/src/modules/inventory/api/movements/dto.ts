// ============================================================
// dto.ts (movements) — Forma que tendría la respuesta de un backend
// real (Tanda 3g de escalabilidad). Deliberadamente DISTINTA del tipo
// de dominio (`shared/types/inventory.types.ts#InventoryMovement`):
// snake_case, mismo criterio que el resto de los DTO del proyecto.
//
// UBICACIÓN: `modules/inventory/api/movements/`, no `shared/api/` — a
// diferencia de `products` (Tanda 3e, dominio transversal), Movimientos
// es EXCLUSIVO de `inventory`: confirmado por grep, ver
// DECISIONES_TECNICAS.md, entrada de Tanda 3g.
//
// SUBCARPETA PROPIA (no un `dto.ts` único junto con Historial): son dos
// VISTAS distintas (aprendizaje 8, GUIA_MIGRACION_MODULO.md) — tablas
// separadas, con columnas y entidades de dominio distintas
// (`InventoryMovement` vs `ProductHistoryEvent`), sin ningún campo
// compartido más allá de lo genérico (id/fecha/sku/nombre/usuario/
// sucursal). Agruparlas en un solo `dto.ts` sería una bolsa sin
// relación real entre sus partes, mismo motivo que separó
// `api/users-roles/`, `api/subscription/`, `api/audit/` en `settings`
// (Tanda 3c).
// ============================================================

export interface InventoryMovementDTO {
  id: string;
  fecha: string;
  sku: string;
  nombre_producto: string;
  tipo: 'in' | 'out' | 'adjustment';
  cantidad: number;
  usuario: string;
  notas: string;
  sucursal_id: string;
}

export interface InventoryMovementsPageDTO {
  data: InventoryMovementDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}
