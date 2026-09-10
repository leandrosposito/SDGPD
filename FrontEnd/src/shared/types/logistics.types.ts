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
import type { DeliveryId, DeliveryHistoryEventId } from './ids.types';

export type DeliveryStatus = 'CREADO' | 'EN_TRANSITO' | 'FINALIZADO' | 'REPROGRAMADO' | 'CANCELADO';

// Evento de historial (ADR-002): append-only, uno por cada transicion
// de estado aplicada via `transitionDelivery`/`reprogramDelivery`
// (deliveries.service.ts) — nunca se edita un evento existente.
export interface DeliveryHistoryEvent {
  id: DeliveryHistoryEventId; // Tanda 9, AUDIT_15#13: antes string plano.
  desde: DeliveryStatus | null; // null solo en el primer evento (alta de la entrega)
  hasta: DeliveryStatus;
  quien: string;
  cuando: string; // ISO datetime
}

// ADR-010 seccion 3 (Tanda 9), correccion de la revision 2026-09-09:
// una transicion posible por cada estado del dominio, no solo las
// permitidas — el cliente nunca deduce por que una no lo esta, lee
// `motivo` server-side. `computeAllowedTransitions` (deliveryStatus.types.ts)
// es la unica funcion que arma este array.
export interface AllowedTransition {
  transicion: DeliveryStatus;
  permitida: boolean;
  motivo?: string; // presente cuando permitida es false
}

// Evento de reprogramacion (ADR-002): append-only, uno por cada vez
// que se reprograma el viaje — se conserva aunque el viaje ya haya
// vuelto a CREADO (es la auditoria de que ocurrio, no el estado actual).
export interface ReprogramacionEvent {
  fechaAnterior: string; // ISO date (yyyy-MM-dd)
  fechaNueva: string; // ISO date (yyyy-MM-dd)
  // Tanda 11 (ADR-013): motivo pasa a resolverse contra el catalogo
  // ('reprogramacion' o 'no-entrega', MotivoTipo) en vez de texto
  // libre. motivo sigue siendo el TEXTO ya resuelto (compatibilidad
  // con DeliveryHistoryModal.tsx, que lo pinta tal cual); motivoCodigo
  // es nuevo y opcional — mismo criterio que
  // DeliveryNoteLine.motivoCodigo/motivoRechazo (ADR-010 seccion 5):
  // el codigo queda consultable, ningun evento viejo se migra.
  motivo: string;
  motivoCodigo?: string;
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
  // Tanda 9 (ADR-010 seccion 3): NUNCA persistido en deliveriesStore —
  // se calcula y adjunta solo en las respuestas de lectura
  // (getDeliveriesPage/getDeliveryById), mismo criterio que `aggregates`
  // en PageResult. Opcional en el tipo porque el propio store interno
  // de deliveries.service.ts no lo lleva.
  allowedTransitions?: AllowedTransition[];
}
