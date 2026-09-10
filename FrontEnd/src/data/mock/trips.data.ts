import { asTripId, asStopId, asVehicleId, asDriverId, asBranchId, asDeliveryId } from '@/shared/types/ids.types';
import type { Trip } from '@/shared/types/trip.types';

// ============================================================
// MOCK DATA — Viajes (Tanda 10B, ADR-011). 2 viajes sembrados, cada
// uno con 2 paradas multi-pedido — deliveryIds reales de
// logistics.data.ts (del-001/del-004 para el primero, del-002/del-005
// para el segundo), mismo criterio que logistics.data.ts (reusar IDs
// reales en vez de inventar referencias que no resuelven, D2 del
// protocolo). Trip 1 en Planificado (todavia no salio); Trip 2 en
// EnTransito con posicionActual (para ejercitar el polling de
// TripDetailPanel sin esperar a que Leandro dispare una transicion).
//
// La fecha se genera en relacion a "hoy", mismo criterio que
// logistics.data.ts, para que el dataset siempre tenga viajes del dia
// actual.
// ============================================================

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TODAY_ISO = toISODate(new Date());
const NOW_ISO = new Date().toISOString();

export const TRIPS_MOCK_DATA: Trip[] = [
  {
    id: asTripId('trip-001'),
    vehicleId: asVehicleId('veh-001'),
    driverId: asDriverId('drv-001'),
    branchId: asBranchId('branch-001'),
    empresaId: 'company-001',
    fecha: TODAY_ISO,
    estado: 'Planificado',
    paradas: [
      {
        id: asStopId('stop-001'),
        tripId: asTripId('trip-001'),
        orden: 1,
        clientName: 'Almacen La Esquina',
        address: 'Av. Belgrano 1234',
        deliveryIds: [asDeliveryId('del-001')],
        estado: 'Pendiente',
        preferenciasEntrega: null,
      },
      {
        id: asStopId('stop-002'),
        tripId: asTripId('trip-001'),
        orden: 2,
        clientName: 'Despensa Los Pinos',
        address: 'Sarmiento 111',
        deliveryIds: [asDeliveryId('del-004')],
        estado: 'Pendiente',
        preferenciasEntrega: { ventanaDesde: '09:00', ventanaHasta: '13:00', diasVisita: ['Lunes', 'Miercoles', 'Viernes'] },
      },
    ],
    version: 1,
    capacidadUsada: { bultos: 22, pesoKg: 340, volumenM3: 1.8, refrigerado: false, zonasHabilitadas: [] },
    sobrecargado: false,
    overrides: [],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  },
  {
    id: asTripId('trip-002'),
    vehicleId: asVehicleId('veh-002'),
    driverId: asDriverId('drv-002'),
    branchId: asBranchId('branch-002'),
    empresaId: 'company-001',
    fecha: TODAY_ISO,
    estado: 'EnTransito',
    paradas: [
      {
        id: asStopId('stop-003'),
        tripId: asTripId('trip-002'),
        orden: 1,
        clientName: 'Supermercado Lider',
        address: 'San Martin 567',
        deliveryIds: [asDeliveryId('del-002')],
        estado: 'Visitada',
        preferenciasEntrega: null,
      },
      {
        id: asStopId('stop-004'),
        tripId: asTripId('trip-002'),
        orden: 2,
        clientName: 'Maxikiosco Norte',
        address: 'Mitre 432',
        deliveryIds: [asDeliveryId('del-005')],
        estado: 'Pendiente',
        preferenciasEntrega: null,
      },
    ],
    version: 1,
    capacidadUsada: { bultos: 18, pesoKg: 260, volumenM3: 2.1, refrigerado: false, zonasHabilitadas: [] },
    sobrecargado: false,
    overrides: [],
    posicionActual: {
      lat: -34.6037,
      lng: -58.3816,
      timestampDispositivo: NOW_ISO,
      timestampServidor: NOW_ISO,
      precision: 15,
    },
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  },
];
