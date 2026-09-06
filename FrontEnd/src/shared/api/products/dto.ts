// ============================================================
// dto.ts (products) — Forma que tendría la respuesta de un backend
// real (Tanda 3e de escalabilidad). Deliberadamente DISTINTA del tipo
// de dominio (`shared/types/inventory.types.ts`): snake_case, mismo
// criterio que el resto de los DTO del proyecto (ver
// docs/GUIA_MIGRACION_MODULO.md).
//
// UBICACIÓN: este `api/` vive en `shared/api/products/`, no en
// `modules/inventory/api/` — decisión de Tanda 3e, ver
// docs/DECISIONES_TECNICAS.md ("Productos es un dominio transversal").
// Productos es consumido por igual por `inventory`, `compras` y
// `orders`; ninguno de los tres es su dueño exclusivo.
// ============================================================

export interface ProductLotDTO {
  id: string;
  numero_lote: string;
  cantidad: number;
  fecha_vencimiento: string;
}

export interface ProductDTO {
  id: string;
  sku: string;
  codigo_barras: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  unidad_medida: string;
  estado: 'active' | 'inactive';
  // Referencia tipada al proveedor real (E3, DECISIONES_TECNICAS.md) —
  // nunca el nombre del proveedor.
  proveedor_id: string;
  lotes: ProductLotDTO[];
  costo: number;
  precio: number;
  margen_mayorista?: number;
  margen_distribuidor?: number;
  margen_minorista?: number;
}

// Stock/mínimo de un producto en una sucursal (E1, DECISIONES_TECNICAS.md):
// entidad separada del catálogo, con su propio ciclo de vida.
export interface ProductStockDTO {
  producto_id: string;
  sucursal_id: string;
  stock: number;
  stock_minimo: number;
}

// Vista compuesta (join catálogo × stock) — misma forma "aplanada" que
// `StockedInventoryItem` del dominio (`InventoryItem & ProductStock`),
// no un objeto anidado: hoy el join es 1:1 y anidar solo agregaría
// indirección sin ningún beneficio real.
export interface StockedProductDTO extends ProductDTO {
  producto_id: string;
  sucursal_id: string;
  stock: number;
  stock_minimo: number;
}

// Agregados (P3, DECISIONES_TECNICAS.md): reemplazan el cálculo que
// hacía TabStockCurrent.tsx en memoria sobre el array completo
// (totalProducts/lowStock/outOfStock/totalValue) — calculados
// server-side sobre TODO lo que matchea el filtro de búsqueda vigente
// en la sucursal, nunca sobre `data` de la página.
//
// CRÍTICO (instrucción explícita de esta tanda): `stock_bajo` tiene
// que usar EXACTAMENTE el mismo criterio que `getLowStockPage`
// (E6: `stock <= stock_minimo`, no `<` estricto) — ver
// `isBelowMinStock` en `products.service.ts`, reusada por ambos.
export interface StockAggregatesDTO {
  total_productos: number;
  stock_bajo: number;
  sin_stock: number;
  valor_inventario: number;
}

export interface StockedProductsPageDTO {
  data: StockedProductDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    aggregates: StockAggregatesDTO;
  };
}

// Envoltorio de lista para Bajo Stock Mínimo — { data, meta } genérico,
// sin `aggregates` (TabLowStock ya usa `totalItems` de la respuesta
// paginada, no un agregado propio — ver E1/E2 de RELEVAMIENTO_INVENTORY.md).
export interface LowStockPageDTO {
  data: StockedProductDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
  };
}

// Payload de alta/edición (RF-PRD-001) — mismos campos que `ProductDTO`
// menos `id`/`lotes` (los lotes no se cargan desde este formulario;
// ver ProductFormModal.tsx, no toca `lots`).
export interface ProductPayloadDTO {
  sku: string;
  codigo_barras: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  unidad_medida: string;
  estado: 'active' | 'inactive';
  proveedor_id: string;
  costo: number;
  precio: number;
  margen_mayorista?: number;
  margen_distribuidor?: number;
  margen_minorista?: number;
}
