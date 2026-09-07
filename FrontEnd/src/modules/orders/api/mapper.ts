import type { Order, OrderItem, OrderHistoryEvent } from '@/shared/types/order.types';
import { asOrderId, asOrderLineId, asClientId } from '@/shared/types/ids.types';
import type { OrderDTO, OrderItemDTO, OrderHistoryEventDTO, CreateOrderDTO } from './dto';

// ============================================================
// mapper.ts (orders) — Único lugar que traduce DTO↔dominio. Nada
// fuera de `orders.service.ts` lo importa (Tanda 3a, mismo criterio
// que `modules/suppliers/api/mapper.ts`).
//
// `OrderFormInput` vive ACÁ, no en `orders.service.ts` — el ciclo de
// import documentado en docs/GUIA_MIGRACION_MODULO.md ("Tropiezos
// concretos de la Tanda 1"): si viviera en el service, `mapper.ts`
// tendría que importarlo desde ahí para `orderFormInputToDTO`, y como
// `orders.service.ts` ya importa `mapper.ts` (para `orderFromDTO`/
// `orderToDTO`), eso arma un ciclo. Se define acá desde el primer
// borrador, no se mueve después.
// ============================================================

// `items` NO incluye `id` (a diferencia de Order.items): el id de
// linea (OrderLineId, Tanda 5/ADR-006) lo asigna el service al crear
// el pedido, igual que ya hacia con `id`/`orderNumber` del pedido en
// si (nextOrderId/nextOrderNumber) — el formulario nunca inventa un id
// de dominio real, antes tampoco deberia haberlo hecho (reusaba el id
// del PRODUCTO, no un id de linea real, ver OrderProductItem.id en
// OrderProductsSection.tsx).
// `cantidadEntregada` tampoco la pide el formulario (Tanda 8,
// ADR-001): un pedido recien creado arranca siempre en 0, el service
// la asigna, igual criterio que `id`.
export type OrderFormInput = Pick<
  Order,
  | 'clientId'
  | 'clientName'
  | 'clientAddress'
  | 'clientZone'
  | 'sellerName'
  | 'paymentMethod'
  | 'subtotal'
  | 'discount'
  | 'tax'
  | 'totalAmount'
  | 'notes'
> & {
  items: Array<Omit<OrderItem, 'id' | 'cantidadEntregada'>>;
};

function orderItemFromDTO(dto: OrderItemDTO): OrderItem {
  return {
    id: asOrderLineId(dto.id),
    sku: dto.sku,
    name: dto.nombre,
    quantity: dto.cantidad,
    unitPrice: dto.precio_unitario,
    subtotal: dto.subtotal,
    cantidadEntregada: dto.cantidad_entregada,
  };
}

function orderItemToDTO(item: OrderItem): OrderItemDTO {
  return {
    id: item.id,
    sku: item.sku,
    nombre: item.name,
    cantidad: item.quantity,
    precio_unitario: item.unitPrice,
    subtotal: item.subtotal,
    cantidad_entregada: item.cantidadEntregada,
  };
}

function historyEventFromDTO(dto: OrderHistoryEventDTO): OrderHistoryEvent {
  return {
    id: dto.id,
    date: dto.fecha,
    status: dto.estado,
    description: dto.descripcion,
  };
}

function historyEventToDTO(event: OrderHistoryEvent): OrderHistoryEventDTO {
  return {
    id: event.id,
    fecha: event.date,
    estado: event.status,
    descripcion: event.description,
  };
}

export function orderFromDTO(dto: OrderDTO): Order {
  return {
    id: asOrderId(dto.id),
    orderNumber: dto.numero_pedido,
    date: dto.fecha,
    clientId: asClientId(dto.cliente.id),
    clientName: dto.cliente.nombre,
    clientAddress: dto.cliente.direccion,
    clientZone: dto.cliente.zona,
    sellerName: dto.vendedor,
    status: dto.estado,
    source: dto.origen,
    paymentMethod: dto.forma_pago,
    subtotal: dto.importes.subtotal,
    discount: dto.importes.descuento,
    tax: dto.importes.impuesto,
    totalAmount: dto.importes.total,
    notes: dto.notas,
    items: dto.items.map(orderItemFromDTO),
    history: dto.historial.map(historyEventFromDTO),
  };
}

// Usada SOLO para sembrar el mock desde data/mock/orders.data.ts
// (dominio) — un backend real nunca la necesitaría, ver mapper.ts de
// suppliers para el mismo comentario.
export function orderToDTO(order: Order): OrderDTO {
  return {
    id: order.id,
    numero_pedido: order.orderNumber,
    fecha: order.date,
    cliente: {
      id: order.clientId,
      nombre: order.clientName,
      direccion: order.clientAddress,
      zona: order.clientZone,
    },
    vendedor: order.sellerName,
    estado: order.status,
    origen: order.source,
    forma_pago: order.paymentMethod,
    importes: {
      subtotal: order.subtotal,
      descuento: order.discount,
      impuesto: order.tax,
      total: order.totalAmount,
    },
    notas: order.notes,
    items: order.items.map(orderItemToDTO),
    historial: order.history.map(historyEventToDTO),
  };
}

export function orderFormInputToDTO(input: OrderFormInput): CreateOrderDTO {
  return {
    cliente: {
      id: input.clientId,
      nombre: input.clientName,
      direccion: input.clientAddress,
      zona: input.clientZone,
    },
    vendedor: input.sellerName,
    forma_pago: input.paymentMethod,
    importes: {
      subtotal: input.subtotal,
      descuento: input.discount,
      impuesto: input.tax,
      total: input.totalAmount,
    },
    notas: input.notes,
    // id vacio a proposito: el service asigna el OrderLineId real al
    // crear el pedido (ver orders.service.ts#createOrder), el mismo
    // criterio que ya usaba para id/numero_pedido del pedido en si.
    // cantidad_entregada siempre 0: un pedido recien creado no tiene
    // ningun remito aplicado todavia (Tanda 8, ADR-001).
    items: input.items.map((item) => ({
      id: '',
      sku: item.sku,
      nombre: item.name,
      cantidad: item.quantity,
      precio_unitario: item.unitPrice,
      subtotal: item.subtotal,
      cantidad_entregada: 0,
    })),
  };
}
