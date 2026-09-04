import type { Order, OrderItem, OrderHistoryEvent } from '@/shared/types/order.types';
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

export type OrderFormInput = Pick<
  Order,
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
  | 'items'
>;

function orderItemFromDTO(dto: OrderItemDTO): OrderItem {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.nombre,
    quantity: dto.cantidad,
    unitPrice: dto.precio_unitario,
    subtotal: dto.subtotal,
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
    id: dto.id,
    orderNumber: dto.numero_pedido,
    date: dto.fecha,
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
    items: input.items.map(orderItemToDTO),
  };
}
