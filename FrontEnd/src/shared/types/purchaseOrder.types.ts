// ============================================================
// SHARED TYPE DEFINITIONS — Purchase Order domain (Compras)
// OrdenDeCompra es una entidad TOP-LEVEL (O1, DECISIONES_TECNICAS.md):
// no vive embebida en Supplier. Referencia a proveedor/sucursal/producto
// siempre por ID tipado (R2), nunca por nombre/coincidencia de texto.
// ============================================================

import type { Branch } from '@/shared/types/session.types';
import type { Supplier } from '@/shared/types/supplier.types';
import type { InventoryItem } from '@/shared/types/inventory.types';
import type { DateRangeQueryFilters } from '@/shared/types/pagination.types';
// Currency no se duplica aca: se reusa desde client.types.ts, mismo
// patron que Branch/Supplier ya importados en inventory.types.ts (un
// tipo compartido en shared/types/ puede ser consumido por otro
// archivo de shared/types/, no es "importar internals de un modulo").
// Se re-exporta para que los consumidores de este archivo (servicio y
// componentes de Compras) tengan un solo import de donde sacarlo.
import type { Currency } from '@/shared/types/client.types';
export type { Currency };

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled';

// Una linea de la orden: producto + cantidad + precio unitario. El
// subtotal de la linea (quantity * unitPrice) NUNCA se persiste — se
// calcula donde haga falta mostrarlo (ver computePurchaseOrderTotal en
// purchaseOrders.service.ts). productId referencia el catalogo real de
// Inventario (InventoryItem), no el catalogo de precios propio de cada
// proveedor (SupplierProduct) — ver O2 en DECISIONES_TECNICAS.md para
// el razonamiento completo de por que se eligio esa entidad.
export interface PurchaseOrderLine {
  id: string;
  productId: InventoryItem['id'];
  quantity: number;
  unitPrice: number;
}

// OrdenDeCompra (O1/O2). Sin campo `amount`/`total`: se deriva SIEMPRE
// de `lines` (computePurchaseOrderTotal), nunca se guarda un numero
// suelto que pueda desincronizarse de las lineas reales — ese era
// exactamente el bug del modelo anterior (SupplierPurchaseOrder con
// date/description/amount, sin lineas).
export interface PurchaseOrder {
  id: string;
  supplierId: Supplier['id'];
  // Sucursal de destino (O5): es un campo de la orden, no de la sesion
  // — una OC ya creada sigue apuntando a la misma sucursal aunque
  // despues se cambie la sucursal activa en el selector.
  branchId: Branch['id'];
  // Una sola moneda por orden (O6): a diferencia de las transacciones
  // de un cliente (que se acumulan en el tiempo y pueden mezclar
  // moneda entre facturas historicas), una orden de compra se emite de
  // una sola vez con un proveedor — no tiene sentido de negocio mezclar
  // ARS y USD dentro de la misma orden. Sin conversion ni cotizacion.
  currency: Currency;
  status: PurchaseOrderStatus;
  createdAt: string;
  lines: PurchaseOrderLine[];
}

// ============================================================
// Consulta paginada (O8, 3.3)
// ============================================================

// search matcheliza contra el ID de la propia orden (unico texto que
// el servicio de Compras conoce sin salirse de sus datos). Filtrar por
// proveedor es un ID exacto (supplierId), no texto libre: el servicio
// de Compras no conoce el NOMBRE del proveedor (eso vive en Suppliers)
// y buscarlo por nombre implicaria importar internals de otro modulo
// (R2) — la vista arma el selector de proveedores con fetchSuppliers()
// (el punto de entrada publico de Suppliers) y pasa el id elegido aca.
// dateFrom/dateTo (DateRangeFilter, tarea transversal) filtran por
// `createdAt` — el unico campo de fecha propio de la orden (O2: no hay
// fecha de "vencimiento" ni "entrega" en este dominio).
export interface PurchaseOrdersQueryFilters extends DateRangeQueryFilters {
  search?: string;
  supplierId?: Supplier['id'];
  status?: PurchaseOrderStatus;
  branchId?: Branch['id'];
}

export type PurchaseOrdersSortField = 'createdAt' | 'total';

// Agregados por estado (O8): clave compuesta estado+moneda, mismo
// patron que AgingBucketAggregate en client.types.ts (bucket+currency).
// `total` es la suma de computePurchaseOrderTotal(order.lines) de todas
// las ordenes de ese estado+moneda — nunca un numero calculado en el
// cliente sobre `items` (P3).
export interface PurchaseOrderStatusAggregate {
  status: PurchaseOrderStatus;
  currency: Currency;
  count: number;
  total: number;
}

export interface PurchaseOrdersAggregates {
  byStatus: PurchaseOrderStatusAggregate[];
}

// ============================================================
// Alta (3.3) — createPurchaseOrder devuelve {success, reason?}, sin
// excepciones ni texto de UI (mismo contrato que useReplenishmentStore/
// useSessionStore). Solo 'draft' o 'sent' son estados de ALTA validos —
// una orden nunca nace 'received' ni 'cancelled', esos son resultados
// de una transicion (ver PurchaseOrderTransitionResult).
// ============================================================

export type CreatePurchaseOrderReason = 'invalid-supplier' | 'no-lines' | 'invalid-line';

export interface CreatePurchaseOrderInput {
  supplierId: Supplier['id'];
  branchId: Branch['id'];
  currency: Currency;
  status?: Extract<PurchaseOrderStatus, 'draft' | 'sent'>;
  lines: Array<Omit<PurchaseOrderLine, 'id'>>;
}

export interface CreatePurchaseOrderResult {
  success: boolean;
  order?: PurchaseOrder;
  reason?: CreatePurchaseOrderReason;
}

// ============================================================
// Transicion de estado (O7). Tabla de transiciones validas en el
// servicio (unica fuente de verdad), no en la vista.
// ============================================================

export type PurchaseOrderTransitionReason = 'invalid-transition' | 'order-not-found';

export interface PurchaseOrderTransitionResult {
  success: boolean;
  order?: PurchaseOrder;
  reason?: PurchaseOrderTransitionReason;
}

// ============================================================
// Generacion desde stock critico (O9/O10) — funcion de alta dedicada,
// distinta de createPurchaseOrder: ademas de crear, decide si agrupa
// en una OC draft existente del mismo proveedor+sucursal (O10). El
// input ya viaja RESUELTO (supplierId real, no supplierName libre): la
// resolucion producto -> proveedor pasa por Inventario antes de llamar
// a este servicio (ver TabPurchases.tsx), Compras no conoce el catalogo
// de productos ni de proveedores.
// ============================================================

export type GeneratePurchaseOrderReason = 'invalid-supplier';

export interface GeneratePurchaseOrderFromSuggestionInput {
  supplierId: Supplier['id'];
  branchId: Branch['id'];
  productId: InventoryItem['id'];
  quantity: number;
  unitPrice: number;
  currency: Currency;
}

export interface GeneratePurchaseOrderResult {
  success: boolean;
  order?: PurchaseOrder;
  // true si la linea se agrego a una OC draft existente para ese
  // proveedor+sucursal en vez de crear una orden nueva (O10).
  merged: boolean;
  reason?: GeneratePurchaseOrderReason;
}
