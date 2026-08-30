import type { LogisticsOrder } from '@/shared/types/logistics.types';

export const LOGISTICS_MOCK_DATA: LogisticsOrder[] = [
  {
    id: 'log-001',
    orderNumber: 'PED-00384',
    clientName: 'Almacen La Esquina',
    address: 'Av. Belgrano 1234',
    status: 'pending',
    zone: 'Norte',
    priority: 'high',
    collectionAmount: 150000,
  },
  {
    id: 'log-002',
    orderNumber: 'PED-00385',
    clientName: 'Supermercado Lider',
    address: 'San Martin 567',
    status: 'in_transit',
    zone: 'Centro',
    priority: 'low',
    collectionAmount: 25000,
  },
  {
    id: 'log-003',
    orderNumber: 'PED-00386',
    clientName: 'Kiosco El Paso',
    address: 'Rivadavia 890',
    status: 'delivered',
    zone: 'Sur',
    priority: 'medium',
    collectionAmount: 12000,
  },
  {
    id: 'log-004',
    orderNumber: 'PED-00387',
    clientName: 'Despensa Los Pinos',
    address: 'Sarmiento 111',
    status: 'pending',
    zone: 'Norte',
    priority: 'medium',
    collectionAmount: 48500,
  },
];
