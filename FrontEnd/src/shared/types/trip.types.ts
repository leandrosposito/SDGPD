import type { TripId, StopId, VehicleId, DriverId, DeliveryId, BranchId } from './ids.types';
import type { VehicleCapacity } from './vehicle.types';

// ============================================================
// trip.types — Viajes y paradas (Tanda 10B, ADR-011). Modelo
// simplificado respecto de la jerarquia completa de ADR-010 seccion 2
// (Viaje -> Parada -> Entrega -> Linea): esta tanda NO introduce una
// entidad "Entrega" propia colgando de la Parada — Stop.deliveryIds
// referencia directo las Delivery existentes de Tanda 9 (ADR-010
// seccion 8, paso 1: "mientras no exista Parada/Viaje implementados,
// Entrega puede seguir viviendo como hoy" — aca sigue viviendo como
// Delivery plana, la Parada la agrupa por id, no la envuelve en un
// tipo nuevo). El vocabulario de 11 estados de Parada de ADR-010
// seccion 2 tampoco se adopta todavia — StopStatus usa el vocabulario
// interino de 4 valores que pide ADR-011 (Pendiente/Visitada/
// NoVisitada/Reprogramada), documentado como reemplazable cuando la
// jerarquia completa se implemente (mismo criterio que
// OrderLogisticoResumen en Tanda 9).
//
// Alcance SUCURSAL (branchId obligatorio en Trip y en
// trips.service.ts) — logistica es alcance SUCURSAL (PROTOCOLO.md
// seccion 1), a diferencia de Vehicle/Driver (alcance EMPRESA, ver
// vehicle.types.ts).
// ============================================================

export type TripStatus = 'Planificado' | 'Despachado' | 'EnTransito' | 'Rendido' | 'Cancelado';

export type StopStatus = 'Pendiente' | 'Visitada' | 'NoVisitada' | 'Reprogramada';

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

// ADR-011 seccion 6 (Opcion C): restriccion blanda de horario de
// visita — vive en la Parada, no en el cliente (ADR-011 lo definia
// sobre ClientAccount; esta tanda no toca client.types.ts, el dato se
// carga al armar la Parada, ver CreateTripModal). El motor de
// asignacion la lee para advertir, nunca para bloquear.
export interface PreferenciasEntrega {
  ventanaDesde: string; // "HH:mm"
  ventanaHasta: string; // "HH:mm"
  diasVisita: DiaSemana[];
}

export interface Stop {
  id: StopId;
  tripId: TripId;
  orden: number;
  clientName: string;
  address: string;
  deliveryIds: DeliveryId[];
  estado: StopStatus;
  preferenciasEntrega?: PreferenciasEntrega | null;
}

// ADR-011 seccion 4: un solo punto, sin historial (eso es
// getTripRoute) — payload minimo para polling cada 10-15s.
export interface TripPosition {
  lat: number;
  lng: number;
  timestampDispositivo: string;
  timestampServidor: string;
  precision?: number;
}

// Mismo patron que AllowedTransition (logistics.types.ts, ADR-010
// seccion 3): un objeto por CADA estado del dominio distinto del
// actual, nunca solo un array de los permitidos.
export interface AllowedTripTransition {
  transicion: TripStatus;
  permitida: boolean;
  motivo?: string;
}

// ADR-011 seccion 2 (sub-opcion A2, correccion 2026-09-09: motivo
// obligatorio, no opcional): un evento por cada vez que se asigna
// carga a este viaje a pesar de exceder la capacidad nominal del
// vehiculo — quien/cuando/por que, distinto de "por cuanto se excedio"
// (deltaBultos, que el servidor calcula solo). Append-only, igual
// criterio que Delivery.historial.
export interface CapacityOverrideEvent {
  quien: string;
  cuando: string;
  motivo: string;
  deltaBultos: number;
}

export interface Trip {
  id: TripId;
  vehicleId: VehicleId;
  driverId: DriverId;
  branchId: BranchId;
  empresaId: string;
  fecha: string; // ISO date (yyyy-MM-dd)
  estado: TripStatus;
  paradas: Stop[];
  // ADR-011 seccion 3: control optimista, incrementada en cada
  // escritura — assignDeliveriesToStop la valida y devuelve 409
  // granular si no matchea.
  version: number;
  // ADR-011 seccion 2 (sub-opcion A2, warning override-able):
  // recalculada SIEMPRE server-side en cada alta/baja de parada/
  // entrega — nunca sumada en el cliente. capacidadTotal no se
  // duplica aca: es Vehicle.capacidad, resuelta via vehicleId.
  capacidadUsada: VehicleCapacity;
  sobrecargado: boolean;
  overrides: CapacityOverrideEvent[];
  posicionActual?: TripPosition;
  createdAt: string;
  updatedAt: string;
  // Mismo patron que Delivery.allowedTransitions (ADR-010 seccion 3):
  // NUNCA persistido en tripsStore, calculado y adjunto solo en las
  // respuestas de lectura.
  allowedTransitions?: AllowedTripTransition[];
}
