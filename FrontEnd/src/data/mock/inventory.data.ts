import type { InventoryData } from '../../shared/types/inventory.types';

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
      name: 'Yerba Mate 1kg Paquete',
      category: 'Infusiones',
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
    // --- Por debajo del minimo ---
    { id: 'inv-003', sku: 'HAR-0000-1K',  name: 'Harina 0000 1kg',          category: 'Almacen',    supplier: 'Molinos Cañuelas',      stock: 80,  minStock: 150, cost: 380,  price: 550 },
    { id: 'inv-004', sku: 'AZU-REF-1K',   name: 'Azucar Refinada 1kg',      category: 'Almacen',    supplier: 'Ledesma',                stock: 40,  minStock: 100, cost: 420,  price: 600 },
    { id: 'inv-005', sku: 'GAL-AGU-200',  name: 'Galletitas de Agua 200g',  category: 'Golosinas',  supplier: 'Bagley',                 stock: 30,  minStock: 120, cost: 280,  price: 420 },
    { id: 'inv-006', sku: 'ACE-OLI-05',   name: 'Aceite de Oliva 500ml',    category: 'Aceites',    supplier: 'Molinos Cañuelas',      stock: 12,  minStock: 50,  cost: 4200, price: 5600 },
    { id: 'inv-007', sku: 'YER-UNI-05',   name: 'Yerba Union 500g',         category: 'Infusiones', supplier: 'Las Marias',             stock: 25,  minStock: 80,  cost: 1100, price: 1520 },
    { id: 'inv-012', sku: 'LAV-CLA-1L',   name: 'Lavandina 1L',             category: 'Limpieza',   supplier: 'Clorox',                 stock: 5,   minStock: 40,  cost: 320,  price: 480 },
    { id: 'inv-013', sku: 'PAP-HIG-X4',   name: 'Papel Higienico x4',       category: 'Limpieza',   supplier: 'Kimberly-Clark',         stock: 15,  minStock: 60,  cost: 950,  price: 1350 },
    { id: 'inv-014', sku: 'JAB-POL-800',  name: 'Jabon en Polvo 800g',      category: 'Limpieza',   supplier: 'Unilever',               stock: 8,   minStock: 50,  cost: 1100, price: 1580 },
    { id: 'inv-016', sku: 'AGU-MIN-15',   name: 'Agua Mineral 1.5L',        category: 'Bebidas',    supplier: 'Danone',                 stock: 3,   minStock: 100, cost: 280,  price: 420 },
    { id: 'inv-018', sku: 'VIN-TIN-750',  name: 'Vino Tinto 750ml',         category: 'Bebidas',    supplier: 'Bodegas Trapiche',       stock: 0,   minStock: 30,  cost: 2200, price: 3200 },
    // --- Exactamente en el limite del minimo (no debe listarse como "bajo minimo") ---
    { id: 'inv-008', sku: 'FID-GUI-500',  name: 'Fideos Guisero 500g',      category: 'Almacen',    supplier: 'Molinos Rio de la Plata', stock: 60,  minStock: 60,  cost: 310,  price: 460 },
    { id: 'inv-009', sku: 'ARR-LAR-1K',   name: 'Arroz Largo Fino 1kg',     category: 'Almacen',    supplier: 'Molinos Rio de la Plata', stock: 90,  minStock: 90,  cost: 650,  price: 890 },
    // --- Por encima del minimo ---
    { id: 'inv-010', sku: 'TOM-PUR-520',  name: 'Pure de Tomate 520g',      category: 'Almacen',    supplier: 'Arcor',                  stock: 300, minStock: 100, cost: 480,  price: 690 },
    { id: 'inv-011', sku: 'DET-LIQ-750',  name: 'Detergente Liquido 750ml', category: 'Limpieza',   supplier: 'Unilever',               stock: 200, minStock: 80,  cost: 890,  price: 1250 },
    { id: 'inv-015', sku: 'GAS-COL-225',  name: 'Gaseosa Cola 2.25L',       category: 'Bebidas',    supplier: 'Coca-Cola Femsa',        stock: 500, minStock: 150, cost: 890,  price: 1300 },
    { id: 'inv-017', sku: 'CER-RUB-1L',   name: 'Cerveza Rubia 1L',         category: 'Bebidas',    supplier: 'Quilmes',                stock: 400, minStock: 200, cost: 980,  price: 1450 },
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
