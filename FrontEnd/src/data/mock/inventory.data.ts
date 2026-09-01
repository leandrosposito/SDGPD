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
      supplierId: 'sup-001',
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
      supplierId: 'sup-002',
      cost: 2800,
      price: 3600,
      wholesaleMargin: 15,
      distributorMargin: 20,
      retailMargin: 30,
      lots: [
        { id: 'lot-003', lotNumber: 'L20240630A', quantity: 50, expirationDate: '2026-06-30T00:00:00Z' }
      ]
    },
    // Nota: el stock por sucursal ya no vive aca (ver E1/E2 en
    // DECISIONES_TECNICAS.md) — ver data/mock/productStock.data.ts.
    // supplierId apunta a uno de los 3 proveedores reales de
    // suppliers.data.ts (antes eran nombres libres sin relacion real).
    { id: 'inv-003', sku: 'HAR-0000-1K',  barcode: '7791003000014', name: 'Harina 0000 1kg',          description: 'Harina de trigo tipo 0000, uso multiple',   category: 'Almacen',    unitOfMeasure: 'Kg',      status: 'active', supplierId: 'sup-001', cost: 380,  price: 550 },
    { id: 'inv-004', sku: 'AZU-REF-1K',   barcode: '7791004000013', name: 'Azucar Refinada 1kg',      description: 'Azucar blanca refinada, paquete de 1kg',     category: 'Almacen',    unitOfMeasure: 'Kg',      status: 'active', supplierId: 'sup-003', cost: 420,  price: 600 },
    { id: 'inv-005', sku: 'GAL-AGU-200',  barcode: '7791005000012', name: 'Galletitas de Agua 200g',  description: 'Galletitas de agua clasicas, paquete 200g',  category: 'Golosinas',  unitOfMeasure: 'Paquete', status: 'active', supplierId: 'sup-003', cost: 280,  price: 420 },
    { id: 'inv-006', sku: 'ACE-OLI-05',   barcode: '7791006000011', name: 'Aceite de Oliva 500ml',    description: 'Aceite de oliva extra virgen, botella 500ml', category: 'Aceites',   unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-001', cost: 4200, price: 5600 },
    { id: 'inv-007', sku: 'YER-UNI-05',   barcode: '7791007000010', name: 'Yerba Union 500g',         description: 'Yerba mate con palo, paquete 500g',          category: 'Infusiones', unitOfMeasure: 'Paquete', status: 'active', supplierId: 'sup-002', cost: 1100, price: 1520 },
    { id: 'inv-012', sku: 'LAV-CLA-1L',   barcode: '7791012000012', name: 'Lavandina 1L',             description: 'Lavandina concentrada, botella 1L',          category: 'Limpieza',   unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-002', cost: 320,  price: 480 },
    { id: 'inv-013', sku: 'PAP-HIG-X4',   barcode: '7791013000011', name: 'Papel Higienico x4',       description: 'Papel higienico hoja doble, pack x4 rollos', category: 'Limpieza',   unitOfMeasure: 'Paquete', status: 'active', supplierId: 'sup-001', cost: 950,  price: 1350 },
    { id: 'inv-014', sku: 'JAB-POL-800',  barcode: '7791014000010', name: 'Jabon en Polvo 800g',      description: 'Jabon en polvo para lavado de ropa, caja 800g', category: 'Limpieza', unitOfMeasure: 'Caja',    status: 'active', supplierId: 'sup-002', cost: 1100, price: 1580 },
    { id: 'inv-016', sku: 'AGU-MIN-15',   barcode: '7791016000018', name: 'Agua Mineral 1.5L',        description: 'Agua mineral sin gas, botella 1.5L',         category: 'Bebidas',    unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-001', cost: 280,  price: 420 },
    { id: 'inv-018', sku: 'VIN-TIN-750',  barcode: '7791018000016', name: 'Vino Tinto 750ml',         description: 'Vino tinto Malbec, botella 750ml',           category: 'Bebidas',    unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-003', cost: 2200, price: 3200 },
    { id: 'inv-008', sku: 'FID-GUI-500',  barcode: '7791008000019', name: 'Fideos Guisero 500g',      description: 'Fideos secos tipo guisero, paquete 500g',    category: 'Almacen',    unitOfMeasure: 'Paquete', status: 'active', supplierId: 'sup-001', cost: 310,  price: 460 },
    { id: 'inv-009', sku: 'ARR-LAR-1K',   barcode: '7791009000018', name: 'Arroz Largo Fino 1kg',     description: 'Arroz largo fino, paquete 1kg',               category: 'Almacen',    unitOfMeasure: 'Kg',      status: 'active', supplierId: 'sup-001', cost: 650,  price: 890 },
    { id: 'inv-010', sku: 'TOM-PUR-520',  barcode: '7791010000014', name: 'Pure de Tomate 520g',      description: 'Pure de tomate clasico, envase tetra 520g',  category: 'Almacen',    unitOfMeasure: 'Unidad',  status: 'active', supplierId: 'sup-003', cost: 480,  price: 690 },
    { id: 'inv-011', sku: 'DET-LIQ-750',  barcode: '7791011000013', name: 'Detergente Liquido 750ml', description: 'Detergente liquido para vajilla, botella 750ml', category: 'Limpieza', unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-003', cost: 890,  price: 1250 },
    { id: 'inv-015', sku: 'GAS-COL-225',  barcode: '7791015000019', name: 'Gaseosa Cola 2.25L',       description: 'Gaseosa sabor cola, botella 2.25L',          category: 'Bebidas',    unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-003', cost: 890,  price: 1300 },
    { id: 'inv-017', sku: 'CER-RUB-1L',   barcode: '7791017000017', name: 'Cerveza Rubia 1L',         description: 'Cerveza rubia, botella retornable 1L',       category: 'Bebidas',    unitOfMeasure: 'Botella', status: 'active', supplierId: 'sup-002', cost: 980,  price: 1450 },
    // supplierId 'sup-999' no existe en suppliers.data.ts a proposito
    // (O9, DECISIONES_TECNICAS.md): caso de borde para probar "Generar
    // OC" con un producto sin proveedor valido — ver sug-004 abajo.
    { id: 'inv-019', sku: 'DESC-LEG-500', barcode: '7791019000015', name: 'Producto Descontinuado 500g', description: 'Proveedor dado de baja del sistema',  category: 'Almacen',    unitOfMeasure: 'Unidad',  status: 'active', supplierId: 'sup-999', cost: 500,  price: 700 },
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
  // Sugerencias por sucursal (E1/3.5): una por cada sucursal activa,
  // con los mismos numeros que su registro real en productStock.data.ts
  // para esa sucursal (branch-001/inv-002, branch-002/inv-001,
  // branch-003/inv-006). No se derivan automaticamente del stock bajo
  // minimo (ver DECISIONES_TECNICAS.md): son un concepto curado aparte,
  // igual que antes de esta tarea.
  suggestions: [
    {
      id: 'sug-001',
      productId: 'inv-002',
      sku: 'YER-MAT-1K',
      productName: 'Yerba Mate 1kg Paquete',
      supplierName: 'Las Marias S.A.C.I.',
      branchId: 'branch-001',
      currentStock: 50,
      minStock: 150,
      suggestedQuantity: 300,
      estimatedCost: 840000,
    },
    {
      id: 'sug-002',
      productId: 'inv-001',
      sku: 'ACE-GIR-15',
      productName: 'Aceite de Girasol 1.5L',
      supplierName: 'Molinos Canuelas S.A.',
      branchId: 'branch-002',
      currentStock: 0,
      minStock: 180,
      suggestedQuantity: 400,
      estimatedCost: 600000,
    },
    {
      id: 'sug-003',
      productId: 'inv-006',
      sku: 'ACE-OLI-05',
      productName: 'Aceite de Oliva 500ml',
      supplierName: 'Molinos Canuelas S.A.',
      branchId: 'branch-003',
      currentStock: 6,
      minStock: 55,
      suggestedQuantity: 100,
      estimatedCost: 420000,
    },
    // Caso de borde O9: producto con supplierId que no existe entre los
    // proveedores reales (inv-019, ver arriba) — "Generar OC" debe
    // rechazarse con feedback claro, sin romper la pantalla.
    {
      id: 'sug-004',
      productId: 'inv-019',
      sku: 'DESC-LEG-500',
      productName: 'Producto Descontinuado 500g',
      supplierName: 'Proveedor Desconocido',
      branchId: 'branch-001',
      currentStock: 3,
      minStock: 40,
      suggestedQuantity: 60,
      estimatedCost: 30000,
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
