import type { InventoryItem, ProductLot, ProductStock, StockedInventoryItem } from '@/shared/types/inventory.types';
import type {
  ProductLotDTO,
  ProductDTO,
  ProductStockDTO,
  StockedProductDTO,
  ProductPayloadDTO,
} from './dto';

// ============================================================
// mapper.ts (products) — Único lugar que traduce DTO↔dominio. Nada
// fuera de `products.service.ts` lo importa (mismo criterio que el
// resto de los `mapper.ts` del proyecto).
//
// `ProductFormInput` vive ACÁ, no en `products.service.ts` — mismo
// motivo que en `orders`/`clients` (ver GUIA_MIGRACION_MODULO.md,
// "Tropiezos concretos de la Tanda 1"): evita el ciclo de import
// service→mapper→service.
// ============================================================

// Mismo shape que aceptaba `createProduct`/`updateProduct` antes de
// esta tanda (`Omit<InventoryItem, 'id'>`) — `ProductFormValues`
// (ProductFormModal.schema.ts) ya es estructuralmente compatible, sin
// cambios en el formulario.
export type ProductFormInput = Omit<InventoryItem, 'id'>;

function productLotFromDTO(dto: ProductLotDTO): ProductLot {
  return {
    id: dto.id,
    lotNumber: dto.numero_lote,
    quantity: dto.cantidad,
    expirationDate: dto.fecha_vencimiento,
  };
}

function productLotToDTO(lot: ProductLot): ProductLotDTO {
  return {
    id: lot.id,
    numero_lote: lot.lotNumber,
    cantidad: lot.quantity,
    fecha_vencimiento: lot.expirationDate,
  };
}

export function productFromDTO(dto: ProductDTO): InventoryItem {
  return {
    id: dto.id,
    sku: dto.sku,
    barcode: dto.codigo_barras,
    name: dto.nombre,
    description: dto.descripcion,
    category: dto.categoria,
    unitOfMeasure: dto.unidad_medida,
    status: dto.estado,
    supplierId: dto.proveedor_id,
    lots: dto.lotes.map(productLotFromDTO),
    cost: dto.costo,
    price: dto.precio,
    wholesaleMargin: dto.margen_mayorista,
    distributorMargin: dto.margen_distribuidor,
    retailMargin: dto.margen_minorista,
  };
}

// Usada solo para sembrar el store desde data/mock/inventory.data.ts
// (dominio) — un backend real nunca la necesitaría.
export function productToDTO(item: InventoryItem): ProductDTO {
  return {
    id: item.id,
    sku: item.sku,
    codigo_barras: item.barcode,
    nombre: item.name,
    descripcion: item.description,
    categoria: item.category,
    unidad_medida: item.unitOfMeasure,
    estado: item.status,
    proveedor_id: item.supplierId,
    lotes: (item.lots ?? []).map(productLotToDTO),
    costo: item.cost,
    precio: item.price,
    margen_mayorista: item.wholesaleMargin,
    margen_distribuidor: item.distributorMargin,
    margen_minorista: item.retailMargin,
  };
}

export function productStockFromDTO(dto: ProductStockDTO): ProductStock {
  return {
    productId: dto.producto_id,
    branchId: dto.sucursal_id,
    stock: dto.stock,
    minStock: dto.stock_minimo,
  };
}

// Usada solo para sembrar el store desde data/mock/productStock.data.ts.
export function productStockToDTO(stock: ProductStock): ProductStockDTO {
  return {
    producto_id: stock.productId,
    sucursal_id: stock.branchId,
    stock: stock.stock,
    stock_minimo: stock.minStock,
  };
}

export function stockedProductFromDTO(dto: StockedProductDTO): StockedInventoryItem {
  return {
    ...productFromDTO(dto),
    productId: dto.producto_id,
    branchId: dto.sucursal_id,
    stock: dto.stock,
    minStock: dto.stock_minimo,
  };
}

export function productFormInputToDTO(input: ProductFormInput): ProductPayloadDTO {
  return {
    sku: input.sku,
    codigo_barras: input.barcode,
    nombre: input.name,
    descripcion: input.description,
    categoria: input.category,
    unidad_medida: input.unitOfMeasure,
    estado: input.status,
    proveedor_id: input.supplierId,
    costo: input.cost,
    precio: input.price,
    margen_mayorista: input.wholesaleMargin,
    margen_distribuidor: input.distributorMargin,
    margen_minorista: input.retailMargin,
  };
}
