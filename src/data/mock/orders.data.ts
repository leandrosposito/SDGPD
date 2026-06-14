import type { Order } from '../../types/order.types';

// ============================================================
// MOCK DATA — Orders
// ============================================================

export const ORDERS_MOCK_DATA: Order[] = [
  {
    id: 'ord-001',
    orderNumber: 'PED-00391',
    date: '2026-06-13T08:15:00Z',
    clientName: 'Almacen La Esquina',
    clientAddress: 'Av. Belgrano 1234',
    clientZone: 'Norte',
    sellerName: 'Gonzalez, Maria',
    status: 'pending',
    source: 'mobile',
    paymentMethod: 'Cuenta Corriente',
    subtotal: 47250,
    discount: 0,
    tax: 9922.5,
    totalAmount: 57172.5,
    notes: 'Entregar antes del mediodia.',
    items: [
      { id: 'oi-101', sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', quantity: 12, unitPrice: 2100, subtotal: 25200 },
      { id: 'oi-102', sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg', quantity: 6,  unitPrice: 3600, subtotal: 21600 },
      { id: 'oi-103', sku: 'GAL-SUR-200', name: 'Galletitas Surtidas 200g', quantity: 1, unitPrice: 450, subtotal: 450 },
    ],
    history: [
      { id: 'h1', date: '2026-06-13T08:15:00Z', status: 'pending', description: 'Pedido ingresado via Mobile App' }
    ]
  },
  {
    id: 'ord-002',
    orderNumber: 'PED-00390',
    date: '2026-06-13T07:45:00Z',
    clientName: 'Supermercado Lider',
    clientAddress: 'San Martin 567',
    clientZone: 'Centro',
    sellerName: 'Ramirez, Carlos',
    status: 'preparing',
    source: 'mobile',
    paymentMethod: 'Transferencia',
    subtotal: 198400,
    discount: 10000,
    tax: 39564,
    totalAmount: 227964,
    notes: '',
    items: [
      { id: 'oi-201', sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', quantity: 48, unitPrice: 2100, subtotal: 100800 },
      { id: 'oi-202', sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml', quantity: 12, unitPrice: 5600, subtotal: 67200 },
      { id: 'oi-203', sku: 'YER-UNI-05', name: 'Yerba Union 500g', quantity: 20, unitPrice: 1520, subtotal: 30400 },
    ],
    history: [
      { id: 'h2', date: '2026-06-13T07:45:00Z', status: 'pending', description: 'Pedido ingresado via Mobile App' },
      { id: 'h3', date: '2026-06-13T08:30:00Z', status: 'preparing', description: 'Preparacion iniciada en deposito' }
    ]
  },
  {
    id: 'ord-003',
    orderNumber: 'PED-00389',
    date: '2026-06-12T16:30:00Z',
    clientName: 'Kiosco El Paso',
    clientAddress: 'Rivadavia 890',
    clientZone: 'Sur',
    sellerName: 'Gonzalez, Maria',
    status: 'dispatched',
    source: 'manual',
    paymentMethod: 'Efectivo',
    subtotal: 15360,
    discount: 0,
    tax: 3225.6,
    totalAmount: 18585.6,
    notes: '',
    items: [
      { id: 'oi-301', sku: 'GAL-SUR-200', name: 'Galletitas Surtidas 200g', quantity: 24, unitPrice: 450, subtotal: 10800 },
      { id: 'oi-302', sku: 'YER-UNI-05', name: 'Yerba Union 500g', quantity: 3, unitPrice: 1520, subtotal: 4560 },
    ],
    history: [
      { id: 'h4', date: '2026-06-12T16:30:00Z', status: 'pending', description: 'Pedido ingresado manualmente' },
      { id: 'h5', date: '2026-06-12T17:00:00Z', status: 'preparing', description: 'Preparacion iniciada' },
      { id: 'h6', date: '2026-06-13T06:30:00Z', status: 'dispatched', description: 'Despachado en reparto matutino' }
    ]
  },
  {
    id: 'ord-004',
    orderNumber: 'PED-00388',
    date: '2026-06-12T11:00:00Z',
    clientName: 'Despensa Los Pinos',
    clientAddress: 'Sarmiento 111',
    clientZone: 'Norte',
    sellerName: 'Ramirez, Carlos',
    status: 'invoiced',
    source: 'mobile',
    paymentMethod: 'Cuenta Corriente',
    subtotal: 63900,
    discount: 0,
    tax: 13419,
    totalAmount: 77319,
    notes: '',
    items: [
      { id: 'oi-401', sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', quantity: 24, unitPrice: 2100, subtotal: 50400 },
      { id: 'oi-402', sku: 'GAL-SUR-200', name: 'Galletitas Surtidas 200g', quantity: 30, unitPrice: 450, subtotal: 13500 },
    ],
    history: [
      { id: 'h7', date: '2026-06-12T11:00:00Z', status: 'pending', description: 'Pedido ingresado via Mobile App' },
      { id: 'h8', date: '2026-06-12T11:30:00Z', status: 'preparing', description: 'Preparacion iniciada' },
      { id: 'h9', date: '2026-06-12T14:00:00Z', status: 'dispatched', description: 'Despachado' },
      { id: 'h10', date: '2026-06-12T16:00:00Z', status: 'delivered', description: 'Entregado al cliente' },
      { id: 'h11', date: '2026-06-12T18:00:00Z', status: 'invoiced', description: 'Factura A-0001-12345 generada' }
    ]
  },
  {
    id: 'ord-005',
    orderNumber: 'PED-00387',
    date: '2026-06-11T09:20:00Z',
    clientName: 'Maxikiosco Norte',
    clientAddress: 'Mitre 432',
    clientZone: 'Norte',
    sellerName: 'Lopez, Beatriz',
    status: 'cancelled',
    source: 'manual',
    paymentMethod: 'Efectivo',
    subtotal: 33600,
    discount: 0,
    tax: 7056,
    totalAmount: 40656,
    notes: 'Cliente cancelo por quiebre de caja.',
    items: [
      { id: 'oi-501', sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml', quantity: 6, unitPrice: 5600, subtotal: 33600 },
    ],
    history: [
      { id: 'h12', date: '2026-06-11T09:20:00Z', status: 'pending', description: 'Pedido ingresado' },
      { id: 'h13', date: '2026-06-11T10:00:00Z', status: 'cancelled', description: 'Cancelado por el vendedor' }
    ]
  },
  {
    id: 'ord-006',
    orderNumber: 'PED-00386',
    date: '2026-06-11T08:00:00Z',
    clientName: 'Almacen La Esquina',
    clientAddress: 'Av. Belgrano 1234',
    clientZone: 'Norte',
    sellerName: 'Gonzalez, Maria',
    status: 'delivered',
    source: 'mobile',
    paymentMethod: 'Cuenta Corriente',
    subtotal: 43200,
    discount: 0,
    tax: 9072,
    totalAmount: 52272,
    notes: '',
    items: [
      { id: 'oi-601', sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg', quantity: 12, unitPrice: 3600, subtotal: 43200 },
    ],
    history: [
      { id: 'h14', date: '2026-06-11T08:00:00Z', status: 'pending', description: 'Pedido ingresado via Mobile App' },
      { id: 'h15', date: '2026-06-11T08:30:00Z', status: 'preparing', description: 'Preparacion iniciada' },
      { id: 'h16', date: '2026-06-11T10:00:00Z', status: 'dispatched', description: 'Despachado' },
      { id: 'h17', date: '2026-06-11T13:00:00Z', status: 'delivered', description: 'Entregado al cliente (Remito R-0001)' }
    ]
  },
];
