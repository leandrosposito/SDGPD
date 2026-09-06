// ============================================================
// dto.ts (product-history) — Forma que tendría la respuesta de un
// backend real (Tanda 3g de escalabilidad). Deliberadamente DISTINTA
// del tipo de dominio (`shared/types/inventory.types.ts#ProductHistoryEvent`):
// snake_case, mismo criterio que el resto de los DTO del proyecto.
//
// UBICACIÓN: `modules/inventory/api/product-history/`, no `shared/api/`
// — Historial es EXCLUSIVO de `inventory` (confirmado por grep), a
// diferencia de `products` (Tanda 3e). SUBCARPETA PROPIA, separada de
// `movements/`: son dos vistas distintas (aprendizaje 8,
// GUIA_MIGRACION_MODULO.md) — ver el comentario equivalente en
// `movements/dto.ts`.
// ============================================================

export interface ProductHistoryEventDTO {
  id: string;
  fecha: string;
  sku: string;
  nombre_producto: string;
  tipo_evento: string;
  descripcion: string;
  usuario: string;
  sucursal_id: string;
}

export interface ProductHistoryPageDTO {
  data: ProductHistoryEventDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}
