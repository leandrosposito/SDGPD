// ============================================================
// SHARED TYPE DEFINITIONS — Logistics domain
//
// DeliveryStatus migro de 3 estados simples a los 5 de ADR-002
// (Tanda 8, corrida completa): CREADO/EN_TRANSITO/FINALIZADO son el
// flujo normal, REPROGRAMADO es transitorio (nunca queda "parado",
// ver deliveryStatus.types.ts), CANCELADO es terminal. El rechazo de
// mercaderia NO es un estado de Delivery — es informacion por linea
// del remito que finaliza el viaje (ver deliveryNote.types.ts).
// ============================================================

import type { Order } from './order.types';
import type { Branch } from './session.types';
import type { DeliveryId } from './ids.types';

export type DeliveryStatus = 'CREADO' | 'EN_TRANSITO' | 'FINALIZADO' | 'REPROGRAMADO' | 'CANCELADO';

// Evento de historial (ADR-002): append-only, uno por cada transicion
// de estado aplicada via `transitionDelivery`/`reprogramDelivery`
// (deliveries.service.ts) — nunca se edita un evento existente.
export interface DeliveryHistoryEvent {
  id: string;
  desde: DeliveryStatus | null; // null solo en el primer evento (alta de la entrega)
  hasta: DeliveryStatus;
  quien: string;
  cuando: string; // ISO datetime
}

// Evento de reprogramacion (ADR-002): append-only, uno por cada vez
// que se reprograma el viaje — se conserva aunque el viaje ya haya
// vuelto a CREADO (es la auditoria de que ocurrio, no el estado actual).
export interface ReprogramacionEvent {
  fechaAnterior: string; // ISO date (yyyy-MM-dd)
  fechaNueva: string; // ISO date (yyyy-MM-dd)
  motivo: string;
  responsable: string;
  timestamp: string; // ISO datetime
}

export interface Delivery {
  id: DeliveryId;
  orderId: Order['id'];
  branchId: Branch['id'];
  clientName: string;
  address: string;
  date: string; // ISO date (yyyy-MM-dd) — dia de la entrega
  estimatedTime: string; // ventana horaria estimada, ej. "09:00 - 11:00"
  status: DeliveryStatus;
  zone: 'Norte' | 'Centro' | 'Sur';
  priority: 'high' | 'medium' | 'low';
  collectionAmount: number;
  historial: DeliveryHistoryEvent[];
  reprogramaciones: ReprogramacionEvent[];
}
