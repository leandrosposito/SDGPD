import type { InventoryData } from '../../types/inventory.types';

export const INVENTORY_MOCK_DATA: InventoryData = {
  items: [
    {
      id: 'inv-001',
      sku: 'ACE-GIR-15',
      name: 'Aceite de Girasol 1.5L',
      category: 'Aceites',
      supplier: 'Molinos Cañuelas',
      stock: 450,
      minStock: 200,
      cost: 1500,
      price: 2100,
    },
    {
      id: 'inv-002',
      sku: 'YER-MAT-1K',
      name: 'Yerba Mate 1kg Paquete',
      category: 'Infusiones',
      supplier: 'Las Marias',
      stock: 50,
      minStock: 150,
      cost: 2800,
      price: 3600,
    },
  ],
  movements: [
    {
      id: 'mov-001',
      date: '2026-06-13T08:30:00Z',
      sku: 'ACE-GIR-15',
      productName: 'Aceite de Girasol 1.5L',
      type: 'in',
      quantity: 500,
      user: 'Admin',
      notes: 'Recepcion OC-0042',
    },
    {
      id: 'mov-002',
      date: '2026-06-13T10:15:00Z',
      sku: 'YER-MAT-1K',
      productName: 'Yerba Mate 1kg Paquete',
      type: 'out',
      quantity: 100,
      user: 'Ventas',
      notes: 'Pedido PED-00384',
    },
  ],
  suggestions: [
    {
      id: 'sug-001',
      sku: 'YER-MAT-1K',
      productName: 'Yerba Mate 1kg Paquete',
      supplierName: 'Molinos Rio de la Plata',
      currentStock: 50,
      minStock: 150,
      suggestedQuantity: 300,
      estimatedCost: 840000,
    },
  ],
};
