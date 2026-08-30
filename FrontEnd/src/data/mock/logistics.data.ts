import type { Delivery } from '@/shared/types/logistics.types';

// ============================================================
// MOCK DATA — Logistics (Entregas)
// Las fechas se generan en relacion a "hoy" (new Date() del sistema)
// para que el dataset de ejemplo siempre tenga entregas del dia actual,
// sin importar cuando se ejecute la app.
// orderId hace referencia a IDs reales de ORDERS_MOCK_DATA (orders.data.ts):
// se reutilizan ord-001..ord-006 porque ese mock solo tiene 6 pedidos.
// ============================================================

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

const TODAY = new Date();
const TODAY_ISO = toISODate(TODAY);
const YESTERDAY_ISO = toISODate(shiftDays(TODAY, -1));
const TOMORROW_ISO = toISODate(shiftDays(TODAY, 1));

export const LOGISTICS_MOCK_DATA: Delivery[] = [
  // --- Hoy: pendientes ---
  {
    id: 'del-001',
    orderId: 'ord-001',
    clientName: 'Almacen La Esquina',
    address: 'Av. Belgrano 1234',
    date: TODAY_ISO,
    estimatedTime: '08:00 - 10:00',
    status: 'pending',
    zone: 'Norte',
    priority: 'high',
    collectionAmount: 57172.5,
  },
  {
    id: 'del-002',
    orderId: 'ord-002',
    clientName: 'Supermercado Lider',
    address: 'San Martin 567',
    date: TODAY_ISO,
    estimatedTime: '09:00 - 11:00',
    status: 'pending',
    zone: 'Centro',
    priority: 'medium',
    collectionAmount: 227964,
  },
  {
    id: 'del-003',
    orderId: 'ord-003',
    clientName: 'Kiosco El Paso',
    address: 'Rivadavia 890',
    date: TODAY_ISO,
    estimatedTime: '09:30 - 11:30',
    status: 'pending',
    zone: 'Sur',
    priority: 'low',
    collectionAmount: 18585.6,
  },
  {
    id: 'del-004',
    orderId: 'ord-004',
    clientName: 'Despensa Los Pinos',
    address: 'Sarmiento 111',
    date: TODAY_ISO,
    estimatedTime: '10:00 - 12:00',
    status: 'pending',
    zone: 'Norte',
    priority: 'medium',
    collectionAmount: 77319,
  },
  {
    id: 'del-005',
    orderId: 'ord-005',
    clientName: 'Maxikiosco Norte',
    address: 'Mitre 432',
    date: TODAY_ISO,
    estimatedTime: '10:30 - 12:30',
    status: 'pending',
    zone: 'Norte',
    priority: 'low',
    collectionAmount: 40656,
  },

  // --- Hoy: en ruta ---
  {
    id: 'del-006',
    orderId: 'ord-006',
    clientName: 'Almacen La Esquina',
    address: 'Av. Belgrano 1234',
    date: TODAY_ISO,
    estimatedTime: '08:00 - 10:00',
    status: 'in_transit',
    zone: 'Norte',
    priority: 'high',
    collectionAmount: 52272,
  },
  {
    id: 'del-007',
    orderId: 'ord-001',
    clientName: 'Minimarket Don Pedro',
    address: 'Av. Colon 220',
    date: TODAY_ISO,
    estimatedTime: '11:00 - 13:00',
    status: 'in_transit',
    zone: 'Sur',
    priority: 'medium',
    collectionAmount: 31800,
  },
  {
    id: 'del-008',
    orderId: 'ord-002',
    clientName: 'Kiosco Central',
    address: '25 de Mayo 45',
    date: TODAY_ISO,
    estimatedTime: '11:30 - 13:30',
    status: 'in_transit',
    zone: 'Centro',
    priority: 'low',
    collectionAmount: 8700,
  },
  {
    id: 'del-009',
    orderId: 'ord-003',
    clientName: 'Almacen San Martin',
    address: 'Alem 300',
    date: TODAY_ISO,
    estimatedTime: '12:00 - 14:00',
    status: 'in_transit',
    zone: 'Norte',
    priority: 'high',
    collectionAmount: 54300,
  },
  {
    id: 'del-010',
    orderId: 'ord-004',
    clientName: 'Supermercado El Sol',
    address: 'Peron 998',
    date: TODAY_ISO,
    estimatedTime: '12:30 - 14:30',
    status: 'in_transit',
    zone: 'Sur',
    priority: 'medium',
    collectionAmount: 97600,
  },

  // --- Hoy: completadas ---
  {
    id: 'del-011',
    orderId: 'ord-005',
    clientName: 'Rotiseria La Pampa',
    address: 'Urquiza 77',
    date: TODAY_ISO,
    estimatedTime: '07:30 - 09:00',
    status: 'delivered',
    zone: 'Centro',
    priority: 'low',
    collectionAmount: 22100,
  },
  {
    id: 'del-012',
    orderId: 'ord-006',
    clientName: 'Almacen La Esquina',
    address: 'Av. Belgrano 1234',
    date: TODAY_ISO,
    estimatedTime: '08:00 - 09:30',
    status: 'delivered',
    zone: 'Norte',
    priority: 'high',
    collectionAmount: 47200,
  },
  {
    id: 'del-013',
    orderId: 'ord-001',
    clientName: 'Despensa Los Pinos',
    address: 'Sarmiento 111',
    date: TODAY_ISO,
    estimatedTime: '08:30 - 10:00',
    status: 'delivered',
    zone: 'Norte',
    priority: 'medium',
    collectionAmount: 19400,
  },
  {
    id: 'del-014',
    orderId: 'ord-002',
    clientName: 'Kiosco El Paso',
    address: 'Rivadavia 890',
    date: TODAY_ISO,
    estimatedTime: '09:00 - 10:30',
    status: 'delivered',
    zone: 'Sur',
    priority: 'low',
    collectionAmount: 12000,
  },

  // --- Ayer (para probar que el filtro por dia excluye lo que no es "hoy") ---
  {
    id: 'del-015',
    orderId: 'ord-003',
    clientName: 'Maxikiosco Norte',
    address: 'Mitre 432',
    date: YESTERDAY_ISO,
    estimatedTime: '10:00 - 11:30',
    status: 'delivered',
    zone: 'Norte',
    priority: 'medium',
    collectionAmount: 40656,
  },
  {
    id: 'del-016',
    orderId: 'ord-004',
    clientName: 'Supermercado Lider',
    address: 'San Martin 567',
    date: YESTERDAY_ISO,
    estimatedTime: '11:00 - 12:30',
    status: 'delivered',
    zone: 'Centro',
    priority: 'low',
    collectionAmount: 25000,
  },

  // --- Mañana ---
  {
    id: 'del-017',
    orderId: 'ord-005',
    clientName: 'Almacen San Martin',
    address: 'Alem 300',
    date: TOMORROW_ISO,
    estimatedTime: '08:00 - 10:00',
    status: 'pending',
    zone: 'Norte',
    priority: 'medium',
    collectionAmount: 54300,
  },
  {
    id: 'del-018',
    orderId: 'ord-006',
    clientName: 'Kiosco Central',
    address: '25 de Mayo 45',
    date: TOMORROW_ISO,
    estimatedTime: '09:00 - 11:00',
    status: 'pending',
    zone: 'Centro',
    priority: 'low',
    collectionAmount: 8700,
  },
];
