import type { VehicleId } from './ids.types';

// ============================================================
// vehicle.types — Vehiculos de reparto (Tanda 10B, ADR-011).
//
// Decision tomada sin ADR propio (regla 2.9 del protocolo): alcance
// EMPRESA, no SUCURSAL — el ADR-011 no discute el alcance de
// Vehicle/Driver en si, solo el de Viaje ("branchId obligatorio" en
// trips.service.ts). Se los trata como maestro de flota compartido
// entre sucursales (mismo criterio que Supplier, M9) en vez de
// duplicar el vehiculo por sucursal — el vinculo con una sucursal
// puntual lo pone el Viaje (Trip.branchId), no el Vehiculo/Chofer. Si
// el negocio real necesita flota exclusiva por sucursal, es un campo
// aditivo (branchId?) el dia que haga falta, no un cambio de forma.
// ============================================================

export interface VehicleCapacity {
  bultos: number;
  pesoKg: number;
  volumenM3: number;
  refrigerado: boolean;
  // Codigos de zona habilitados para este vehiculo (mismo vocabulario
  // que Delivery.zone: 'Norte' | 'Centro' | 'Sur') — array de string,
  // no un enum cerrado, para no acoplar capacity a las 3 zonas de hoy
  // si el catalogo de zonas crece.
  zonasHabilitadas: string[];
}

export interface Vehicle {
  id: VehicleId;
  patente: string;
  tipo: string;
  capacidad: VehicleCapacity;
  activo: boolean;
}
