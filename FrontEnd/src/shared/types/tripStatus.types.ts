import type { TripStatus, AllowedTripTransition } from './trip.types';

// ============================================================
// tripStatus.types — Maquina de estados del Viaje (Tanda 10B,
// ADR-011). Mismo patron que deliveryStatus.types.ts (ADR-002/ADR-010
// seccion 3): un unico mapa tipado, ningun componente decide una
// transicion por su cuenta — trips.service.ts#transitionTrip es el
// unico punto que aplica un cambio, siempre pasando por
// puedeTransicionarViaje primero.
//
// Planificado -> Despachado -> EnTransito -> Rendido: flujo normal
// (Rendido = "rendicion", el operador cierra el viaje explicitamente,
// ADR-010 seccion 2 — no ocurre solo porque la ultima Parada termino).
// Cancelado es terminal, alcanzable desde Planificado/Despachado (no
// desde EnTransito: un viaje ya en la calle no se cancela, se rinde
// con lo que se pudo entregar — cancelar ahi borraria informacion real
// de que el camion salio).
// ============================================================

export const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  Planificado: ['Despachado', 'Cancelado'],
  Despachado: ['EnTransito', 'Cancelado'],
  EnTransito: ['Rendido'],
  Rendido: [],
  Cancelado: [],
};

export function puedeTransicionarViaje(desde: TripStatus, hasta: TripStatus): boolean {
  return TRIP_TRANSITIONS[desde].includes(hasta);
}

const TODOS_LOS_ESTADOS_VIAJE: readonly TripStatus[] = ['Planificado', 'Despachado', 'EnTransito', 'Rendido', 'Cancelado'];

function motivoNoPermitidaViaje(desde: TripStatus, hasta: TripStatus): string {
  if (desde === 'Rendido') return 'Este viaje ya esta rendido — no admite mas transiciones.';
  if (desde === 'Cancelado') return 'Este viaje esta cancelado — no admite mas transiciones.';
  if (hasta === 'Cancelado' && desde === 'EnTransito') return 'Un viaje que ya salio a la calle no se cancela — rendilo con lo que se pudo entregar.';
  if (hasta === 'Rendido' && desde !== 'EnTransito') return 'Solo se rinde un viaje que esta en transito.';
  return `No se puede pasar de "${desde}" a "${hasta}" directamente.`;
}

// Contrato de API (ADR-010 seccion 3, extendido a Viaje por ADR-011):
// calculado UNA sola vez aca — trips.service.ts y TripDetailPanel.tsx
// leen el resultado, ninguno vuelve a llamar puedeTransicionarViaje.
export function computeAllowedTripTransitions(desde: TripStatus): AllowedTripTransition[] {
  return TODOS_LOS_ESTADOS_VIAJE.filter((hasta) => hasta !== desde).map((hasta) => {
    const permitida = puedeTransicionarViaje(desde, hasta);
    return permitida ? { transicion: hasta, permitida } : { transicion: hasta, permitida, motivo: motivoNoPermitidaViaje(desde, hasta) };
  });
}
