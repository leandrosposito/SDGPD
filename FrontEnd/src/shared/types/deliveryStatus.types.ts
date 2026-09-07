import type { DeliveryStatus } from './logistics.types';

// ============================================================
// deliveryStatus.types — Maquina de estados del viaje (ADR-002,
// Tanda 8 de la corrida completa). Unico mapa tipado de transiciones
// validas: ningun componente decide una transicion por su cuenta,
// todo lo que mueve el estado de una Delivery llama a
// `puedeTransicionar` antes de aplicar el cambio (deliveries.service.ts).
//
// REPROGRAMADO es transitorio a proposito (ADR-002): nunca es un
// estado "de descanso" — reprogramDelivery (deliveries.service.ts)
// valida la transicion a REPROGRAMADO y de inmediato la de vuelta a
// CREADO en la misma llamada, registrando ambos pasos en el
// historial. Se permite reprogramar tanto desde CREADO (todavia no
// salio) como desde EN_TRANSITO (ya en la calle).
//
// FINALIZADO y CANCELADO son terminales: sin transiciones de salida.
// El rechazo de mercaderia NO es un estado de este mapa (ver
// deliveryNote.types.ts) — es informacion a nivel de LINEA del remito
// que finaliza el viaje.
// ============================================================

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  CREADO: ['EN_TRANSITO', 'CANCELADO', 'REPROGRAMADO'],
  EN_TRANSITO: ['FINALIZADO', 'REPROGRAMADO', 'CANCELADO'],
  REPROGRAMADO: ['CREADO'],
  FINALIZADO: [],
  CANCELADO: [],
};

export function puedeTransicionar(desde: DeliveryStatus, hasta: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[desde].includes(hasta);
}
