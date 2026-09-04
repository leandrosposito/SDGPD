import type { OrderStatus, OrderSource, PaymentMethod } from '@/shared/types/order.types';

// ============================================================
// dto.ts (orders) — Forma que tendría la respuesta de un backend
// real (Tanda 3a de escalabilidad). Deliberadamente DISTINTA del tipo
// de dominio (`shared/types/order.types.ts#Order`): snake_case y
// campos agrupados por concepto (`cliente`, `importes`), mismo
// criterio que `SupplierDTO` (Tanda 1) — ver
// docs/GUIA_MIGRACION_MODULO.md, "Cómo definir el DTO cuando no se
// conoce el backend real". No es una promesa de que el backend real
// vaya a tener exactamente esta forma, es para que el mapper traduzca
// algo genuinamente distinto, no un alias 1:1 del dominio.
// ============================================================

export interface OrderItemDTO {
  id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface OrderHistoryEventDTO {
  id: string;
  fecha: string;
  estado: OrderStatus;
  descripcion: string;
}

export interface OrderDTO {
  id: string;
  numero_pedido: string;
  fecha: string;
  cliente: {
    nombre: string;
    direccion: string;
    zona: string;
  };
  vendedor: string;
  estado: OrderStatus;
  origen: OrderSource;
  forma_pago: PaymentMethod;
  importes: {
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
  };
  notas: string;
  items: OrderItemDTO[];
  historial: OrderHistoryEventDTO[];
}

// Agregados (P3, DECISIONES_TECNICAS.md): el servidor los calcula
// sobre TODO lo que matchea el scope de filtros (menos el filtro de
// estado — mismo criterio que PurchaseOrdersAggregates/
// DeliveryAggregates), nunca sobre `items` de la página. OrderKpis
// (la UI) los consume directo, ya no recorre el array de pedidos.
export interface OrdersAggregatesDTO {
  pedidos_hoy: number;
  pendientes: number;
  preparando: number;
  despachados: number;
  facturacion_hoy: number;
}

// Envoltorio de lista: { data, meta } es el genérico de todos los DTO
// de página del proyecto (ver dto.ts de suppliers) — `aggregates`
// dentro de `meta` es la única extensión sobre ese genérico, necesaria
// porque este listado (a diferencia de suppliers) tiene KPIs
// calculados server-side.
export interface OrdersPageDTO {
  data: OrderDTO[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    aggregates: OrdersAggregatesDTO;
  };
}

// Payload de alta (RF-PED-001, alta manual desde CreateOrderModal).
// Solo los campos que el formulario efectivamente pide — igual
// criterio que CreateSupplierDTO. `id`/`numero_pedido`/`fecha`/
// `estado`/`historial` los genera el service (backend real: el
// propio servidor), nunca el cliente.
export interface CreateOrderDTO {
  cliente: {
    nombre: string;
    direccion: string;
    zona: string;
  };
  vendedor: string;
  forma_pago: PaymentMethod;
  importes: {
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
  };
  notas: string;
  items: OrderItemDTO[];
}
