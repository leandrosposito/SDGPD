import type { OrderId, OrderLineId, DeliveryId } from './ids.types';

// ============================================================
// deliveryNote.types — Remitos (ADR-001, Tanda 8 de la corrida
// completa). Documentos de entrega propios, append-only: un remito
// nunca se edita despues de creado, una correccion es un remito nuevo
// (deliveries.service.ts#registrarEntrega solo crea, nunca actualiza).
//
// Cada linea del remito referencia una OrderLineId tipada (no un
// indice ni un nombre de producto) y descompone lo "ofrecido" en esa
// linea puntual en entregado + rechazado:
//   cantidadOfrecida = cantidadEntregada + cantidadRechazada
// "Rechazo total" de una linea es cantidadEntregada === 0 con
// cantidadRechazada > 0; "rechazo total" del remito (ADR-002) es el
// caso donde TODAS sus lineas estan en rechazo total — se deriva con
// `isRechazoTotal`, nunca es un campo separado.
// ============================================================

export interface DeliveryNoteLine {
  orderLineId: OrderLineId;
  cantidadOfrecida: number;
  cantidadEntregada: number;
  cantidadRechazada: number;
  motivoRechazo?: string;
}

export interface DeliveryNote {
  id: string;
  orderId: OrderId;
  deliveryId: DeliveryId;
  fecha: string; // ISO datetime de creacion del remito
  lines: DeliveryNoteLine[];
  // IDs de evidencia (ADR-005) — vacio si ninguna linea tuvo rechazo,
  // nunca el archivo en si (ver uploads.service.ts).
  evidenciaIds: string[];
  creadoEn: string; // ISO datetime
  creadoPor: string; // SessionUser.fullName de quien registro la entrega
}

export function isRechazoTotal(lines: DeliveryNoteLine[]): boolean {
  if (lines.length === 0) return false;
  return lines.every((line) => line.cantidadOfrecida > 0 && line.cantidadRechazada === line.cantidadOfrecida);
}
