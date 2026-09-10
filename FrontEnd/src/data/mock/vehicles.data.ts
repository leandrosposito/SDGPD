import { asVehicleId } from '@/shared/types/ids.types';
import type { Vehicle } from '@/shared/types/vehicle.types';

// ============================================================
// MOCK DATA — Vehiculos (Tanda 10B, ADR-011). Alcance EMPRESA (ver
// vehicle.types.ts) — 4 vehiculos con capacidades variadas: uno
// refrigerado (veh-002), uno con zona restringida (veh-004, solo
// Centro — no puede tomar paradas de Norte/Sur).
// ============================================================

export const VEHICLES_MOCK_DATA: Vehicle[] = [
  {
    id: asVehicleId('veh-001'),
    patente: 'AB123CD',
    tipo: 'Camioneta',
    capacidad: { bultos: 80, pesoKg: 1200, volumenM3: 6, refrigerado: false, zonasHabilitadas: ['Norte', 'Centro', 'Sur'] },
    activo: true,
  },
  {
    id: asVehicleId('veh-002'),
    patente: 'AC456EF',
    tipo: 'Camion refrigerado',
    capacidad: { bultos: 60, pesoKg: 2000, volumenM3: 10, refrigerado: true, zonasHabilitadas: ['Norte', 'Centro', 'Sur'] },
    activo: true,
  },
  {
    id: asVehicleId('veh-003'),
    patente: 'AD789GH',
    tipo: 'Camion',
    capacidad: { bultos: 150, pesoKg: 4000, volumenM3: 18, refrigerado: false, zonasHabilitadas: ['Norte', 'Centro', 'Sur'] },
    activo: true,
  },
  {
    id: asVehicleId('veh-004'),
    patente: 'AE012IJ',
    tipo: 'Utilitario',
    capacidad: { bultos: 35, pesoKg: 500, volumenM3: 3, refrigerado: false, zonasHabilitadas: ['Centro'] },
    activo: true,
  },
];
