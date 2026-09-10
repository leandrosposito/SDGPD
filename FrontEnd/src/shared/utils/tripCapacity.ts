import type { Stop } from '@/shared/types/trip.types';
import type { VehicleCapacity } from '@/shared/types/vehicle.types';

// ============================================================
// tripCapacity — Calculo de capacidad usada de un Viaje (Tanda 10B,
// ADR-011 seccion 2). Extraido de trips.service.ts a su propio modulo
// SIN dependencia de httpClient para poder ejercitarse con un smoke
// script puro (node, sin import.meta.env) — mismo criterio que
// deliveryStatus.types.ts/orderLogistics.ts en Tanda 9.
//
// Limitacion conocida (documentada en trips.service.ts): ni Order ni
// Delivery modelan hoy peso/volumen/bultos por producto — bultos se
// calcula como la CANTIDAD DE ENTREGAS asignadas (un hecho real y
// contable), pesoKg/volumenM3 quedan en 0.
// ============================================================

export function computeCapacidadUsada(paradas: Stop[]): VehicleCapacity {
  const bultos = paradas.reduce((sum, stop) => sum + stop.deliveryIds.length, 0);
  return { bultos, pesoKg: 0, volumenM3: 0, refrigerado: false, zonasHabilitadas: [] };
}

export function excedeCapacidad(usada: VehicleCapacity, total: VehicleCapacity): boolean {
  return usada.bultos > total.bultos;
}
