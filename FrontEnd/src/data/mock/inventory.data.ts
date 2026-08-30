import type { InventoryData } from '@/shared/types/inventory.types';

export const INVENTORY_MOCK_DATA: InventoryData = {
  items: [
    {
      id: 'inv-001',
      sku: 'ACE-GIR-15',
      barcode: '7791234567890',
      name: 'Aceite de Girasol 1.5L',
      description: 'Aceite refinado de girasol, envase PET',
      category: 'Aceites',
      unitOfMeasure: 'Botella',
      status: 'active',
      supplier: 'Molinos Cañuelas',
      stock: 450,
      minStock: 200,
      cost: 1500,
      price: 2100,
      wholesaleMargin: 20,
      distributorMargin: 30,
      retailMargin: 40,
      lots: [
        { id: 'lot-001', lotNumber: 'L20251101A', quantity: 250, expirationDate: '2026-11-01T00:00:00Z' },
        { id: 'lot-002', lotNumber: 'L20251215B', quantity: 200, expirationDate: '2026-12-15T00:00:00Z' }
      ]
    },
    {
      id: 'inv-002',
      sku: 'YER-MAT-1K',
      barcode: '7799876543210',
      name: 'Yerba Mate 1kg Paquete',
      description: 'Yerba mate tradicional con palo',
      category: 'Infusiones',
      unitOfMeasure: 'Paquete',
      status: 'active',
      supplier: 'Las Marias',
      stock: 50,
      minStock: 150,
      cost: 2800,
      price: 3600,
      wholesaleMargin: 15,
      distributorMargin: 20,
      retailMargin: 30,
      lots: [
        { id: 'lot-003', lotNumber: 'L20240630A', quantity: 50, expirationDate: '2026-06-30T00:00:00Z' }
      ]
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
  history: [
    {
      id: 'hist-001',
      date: '2026-06-12T09:00:00Z',
      sku: 'ACE-GIR-15',
      productName: 'Aceite de Girasol 1.5L',
      eventType: 'Precio cambiado',
      description: 'Aumento de costo de proveedor un 5%',
      user: 'Admin',
    },
    {
      id: 'hist-002',
      date: '2026-06-13T08:30:00Z',
      sku: 'ACE-GIR-15',
      productName: 'Aceite de Girasol 1.5L',
      eventType: 'Ingreso',
      description: 'Ingreso +500 desde OC-0042',
      user: 'Admin',
    },
    {
      id: 'hist-003',
      date: '2026-06-10T14:20:00Z',
      sku: 'YER-MAT-1K',
      productName: 'Yerba Mate 1kg Paquete',
      eventType: 'Proveedor actualizado',
      description: 'Cambio de proveedor a Molinos Rio de la Plata',
      user: 'Admin',
    }
  ],
};
