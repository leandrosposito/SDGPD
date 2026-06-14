import type { Supplier } from '../../types/supplier.types';

// ============================================================
// MOCK DATA — Suppliers
// ============================================================

export const SUPPLIERS_MOCK_DATA: Supplier[] = [
  {
    id: 'sup-001',
    name: 'Molinos Canuelas S.A.',
    cuit: '30-54321678-9',
    phone: '+54 11 4800-1200',
    contactName: 'Ricardo Leiva',
    contactEmail: 'r.leiva@molinoscanuela.com.ar',
    address: 'Av. Corrientes 4521, Piso 8',
    city: 'Buenos Aires',
    paymentTerms: '30 dias',
    category: 'Alimentos Secos',
    pendingOrdersCount: 1,
    daysUntilExpiration: 15,
    currentBalance: 95000,
    hasOverdueDebt: false,
    products: [
      { id: 'sp-101', sku: 'ACE-GIR-15', name: 'Aceite Girasol 1.5L', category: 'Aceites', cost: 1500, lastUpdate: '2026-06-01T00:00:00Z' },
      { id: 'sp-102', sku: 'ACE-OLI-05', name: 'Aceite Oliva 500ml', category: 'Aceites', cost: 4200, lastUpdate: '2026-05-20T00:00:00Z' },
    ],
    purchaseOrders: [
      { id: 'oc-1001', date: '2026-06-10T00:00:00Z', description: 'Pedido mensual aceites', amount: 120000, status: 'paid' },
      { id: 'oc-1002', date: '2026-06-01T00:00:00Z', description: 'Reposicion aceite girasol', amount: 95000, status: 'pending' },
    ],
  },
  {
    id: 'sup-002',
    name: 'Las Marias S.A.C.I.',
    cuit: '30-67891234-5',
    phone: '+54 3756 42-5000',
    contactName: 'Claudia Rios',
    contactEmail: 'c.rios@lasmarias.com.ar',
    address: 'Ruta Provincial 5, Km 12',
    city: 'Apostoles, Misiones',
    paymentTerms: '60 dias',
    category: 'Infusiones',
    pendingOrdersCount: 0,
    daysUntilExpiration: null,
    currentBalance: 210000,
    hasOverdueDebt: true,
    products: [
      { id: 'sp-201', sku: 'YER-TAR-1K', name: 'Yerba Taragui 1kg', category: 'Infusiones', cost: 2800, lastUpdate: '2026-06-05T00:00:00Z' },
      { id: 'sp-202', sku: 'YER-UNI-05', name: 'Yerba Union 500g', category: 'Infusiones', cost: 1450, lastUpdate: '2026-05-28T00:00:00Z' },
    ],
    purchaseOrders: [
      { id: 'oc-2001', date: '2026-05-01T00:00:00Z', description: 'Pedido yerba mayo', amount: 210000, status: 'overdue' },
      { id: 'oc-2002', date: '2026-04-01T00:00:00Z', description: 'Pedido yerba abril', amount: 185000, status: 'paid' },
    ],
  },
  {
    id: 'sup-003',
    name: 'Arcor S.A.I.C.',
    cuit: '30-50456789-1',
    phone: '+54 11 5555-8000',
    contactName: 'Marcelo Torres',
    contactEmail: 'm.torres@arcor.com.ar',
    address: 'Av. del Libertador 7208',
    city: 'Buenos Aires',
    paymentTerms: '15 dias',
    category: 'Golosinas',
    pendingOrdersCount: 2,
    daysUntilExpiration: 5,
    currentBalance: 0,
    hasOverdueDebt: false,
    products: [
      { id: 'sp-301', sku: 'GAL-SUR-200', name: 'Galletitas Surtidas 200g', category: 'Golosinas', cost: 680, lastUpdate: '2026-06-08T00:00:00Z' },
    ],
    purchaseOrders: [
      { id: 'oc-3001', date: '2026-06-12T00:00:00Z', description: 'Reposicion galletitas', amount: 45000, status: 'paid' },
    ],
  },
];
