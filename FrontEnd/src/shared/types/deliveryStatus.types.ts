import type { DeliveryStatus, AllowedTransition } from './logistics.types';

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

// Motivo server-side para cada transicion NO permitida desde un estado
// dado — Tanda 9, ADR-010 seccion 3 (correccion 2026-09-09). Sin esto
// el cliente tendria que inventar su propio texto o, peor, deducir la
// regla de negocio para explicarselo al usuario (exactamente el
// antipatron que esta correccion cierra).
const TODOS_LOS_ESTADOS: readonly DeliveryStatus[] = ['CREADO', 'EN_TRANSITO', 'FINALIZADO', 'REPROGRAMADO', 'CANCELADO'];

function motivoNoPermitida(desde: DeliveryStatus, hasta: DeliveryStatus): string {
  if (desde === 'FINALIZADO') return 'Esta entrega ya está finalizada — no admite más transiciones.';
  if (desde === 'CANCELADO') return 'Esta entrega está cancelada — no admite más transiciones.';
  if (hasta === 'FINALIZADO' && desde === 'CREADO') return 'Todavía no salió a la calle — marcala "En ruta" antes de registrar la entrega.';
  if (hasta === 'CREADO' && desde !== 'REPROGRAMADO') return 'Solo se vuelve a "Creada" reprogramando la entrega.';
  return `No se puede pasar de "${desde}" a "${hasta}" directamente.`;
}

// Contrato de API (ADR-010 seccion 3): un objeto por CADA estado del
// dominio distinto del actual, nunca solo un array de los permitidos
// — `allowedTransitions` calculado UNA sola vez acá, tanto el mock
// (deliveries.service.ts) como el cliente (DeliveriesTable.tsx) leen
// el resultado, ninguno de los dos vuelve a llamar `puedeTransicionar`
// por su cuenta para decidir que mostrar.
export function computeAllowedTransitions(desde: DeliveryStatus): AllowedTransition[] {
  return TODOS_LOS_ESTADOS.filter((hasta) => hasta !== desde).map((hasta) => {
    const permitida = puedeTransicionar(desde, hasta);
    return permitida ? { transicion: hasta, permitida } : { transicion: hasta, permitida, motivo: motivoNoPermitida(desde, hasta) };
  });
}
