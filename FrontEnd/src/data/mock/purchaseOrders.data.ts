import type { PurchaseOrder } from '@/shared/types/purchaseOrder.types';

// ============================================================
// MOCK DATA — Purchase Orders (Compras)
// Referencian proveedor (Supplier['id']) y producto (InventoryItem['id'])
// por ID real, contra suppliers.data.ts / inventory.data.ts — no hay
// nombres libres. Reparto entre los 3 proveedores (sup-001/002/003),
// las 3 sucursales activas (branch-001/002/003), los 4 estados y las
// 2 monedas (3.2).
//
// Casos de borde a proposito:
// - po-001: una sola linea.
// - po-002: muchas lineas (5).
// - po-003: cancelada.
// - po-004: recibida.
// - po-005: producto fuera de catalogo (productId 'inv-999', que no
//   existe en inventory.data.ts) — prueba que el detalle no rompe con
//   un producto que ya no esta en el catalogo (3.2). Ver
//   PurchaseOrderDetailPanel/PurchaseOrdersTable para como se resuelve
//   (nombre "Producto no disponible", sin undefined en pantalla).
// - po-006/po-007: mismo proveedor+sucursal, ambas en draft — muestran
//   que "generar OC" desde stock critico se agruparia en una sola
//   (O10) si vinieran de esa via; estas dos se crearon manualmente
//   como dos ordenes separadas para no interferir con la verificacion
//   en el navegador de la agrupacion real (que crea sus propias OC).
// ============================================================

const PRODUCTS_BY_SUPPLIER: Record<string, string[]> = {
  'sup-001': ['inv-001', 'inv-003', 'inv-006', 'inv-013', 'inv-016', 'inv-008', 'inv-009'],
  'sup-002': ['inv-002', 'inv-007', 'inv-012', 'inv-014', 'inv-017'],
  'sup-003': ['inv-004', 'inv-005', 'inv-010', 'inv-011', 'inv-015', 'inv-018'],
};

const UNIT_PRICE_BY_PRODUCT: Record<string, number> = {
  'inv-001': 1500, 'inv-003': 380, 'inv-006': 4200, 'inv-013': 950, 'inv-016': 280, 'inv-008': 310, 'inv-009': 650,
  'inv-002': 2800, 'inv-007': 1100, 'inv-012': 320, 'inv-014': 1100, 'inv-017': 980,
  'inv-004': 420, 'inv-005': 280, 'inv-010': 480, 'inv-011': 890, 'inv-015': 890, 'inv-018': 2200,
};

let lineSeq = 0;
function line(productId: string, quantity: number): { id: string; productId: string; quantity: number; unitPrice: number } {
  lineSeq += 1;
  return {
    id: `pol-${String(lineSeq).padStart(4, '0')}`,
    productId,
    quantity,
    unitPrice: UNIT_PRICE_BY_PRODUCT[productId] ?? 1000,
  };
}

export const PURCHASE_ORDERS_MOCK_DATA: PurchaseOrder[] = [
  // --- Una sola linea ---
  {
    id: 'po-001',
    supplierId: 'sup-001',
    branchId: 'branch-001',
    currency: 'ARS',
    status: 'draft',
    createdAt: '2026-08-20T09:00:00Z',
    lines: [line('inv-001', 200)],
  },
  // --- Muchas lineas (5) ---
  {
    id: 'po-002',
    supplierId: 'sup-002',
    branchId: 'branch-002',
    currency: 'ARS',
    status: 'sent',
    createdAt: '2026-08-15T11:30:00Z',
    lines: [
      line('inv-002', 150),
      line('inv-007', 80),
      line('inv-012', 60),
      line('inv-014', 40),
      line('inv-017', 100),
    ],
  },
  // --- Cancelada ---
  {
    id: 'po-003',
    supplierId: 'sup-003',
    branchId: 'branch-003',
    currency: 'ARS',
    status: 'cancelled',
    createdAt: '2026-08-10T14:00:00Z',
    lines: [line('inv-005', 300), line('inv-010', 120)],
  },
  // --- Recibida ---
  {
    id: 'po-004',
    supplierId: 'sup-001',
    branchId: 'branch-002',
    currency: 'ARS',
    status: 'received',
    createdAt: '2026-07-28T08:45:00Z',
    lines: [line('inv-006', 90), line('inv-009', 200)],
  },
  // --- Producto fuera de catalogo (inv-999 no existe en inventory.data.ts) ---
  {
    id: 'po-005',
    supplierId: 'sup-002',
    branchId: 'branch-001',
    currency: 'ARS',
    status: 'received',
    createdAt: '2026-06-30T10:00:00Z',
    lines: [line('inv-017', 60), line('inv-999', 50)],
  },
  // --- USD: sucursal con proveedor de importacion ---
  {
    id: 'po-006',
    supplierId: 'sup-001',
    branchId: 'branch-003',
    currency: 'USD',
    status: 'sent',
    createdAt: '2026-08-22T09:00:00Z',
    lines: [line('inv-006', 300)],
  },
  {
    id: 'po-007',
    supplierId: 'sup-003',
    branchId: 'branch-001',
    currency: 'USD',
    status: 'draft',
    createdAt: '2026-08-25T16:20:00Z',
    lines: [line('inv-018', 150), line('inv-018', 50)],
  },
];

// Relleno para probar paginacion real (3.2: al menos 30 en total).
// Determinístico (sin Math.random()): cicla proveedor/sucursal/estado/
// moneda para cubrir la matriz completa varias veces con datos
// reproducibles entre corridas.
const SUPPLIER_IDS = ['sup-001', 'sup-002', 'sup-003'];
const BRANCH_IDS = ['branch-001', 'branch-002', 'branch-003'];
const STATUSES: PurchaseOrder['status'][] = ['draft', 'sent', 'received', 'cancelled'];
const CURRENCIES: PurchaseOrder['currency'][] = ['ARS', 'USD'];

const bulkOrders: PurchaseOrder[] = [];
for (let i = 0; i < 26; i++) {
  const supplierId = SUPPLIER_IDS[i % SUPPLIER_IDS.length];
  const branchId = BRANCH_IDS[(i + 1) % BRANCH_IDS.length];
  const status = STATUSES[i % STATUSES.length];
  const currency = CURRENCIES[i % CURRENCIES.length];
  const products = PRODUCTS_BY_SUPPLIER[supplierId];
  const lineCount = (i % 3) + 1; // 1, 2 o 3 lineas
  const lines = Array.from({ length: lineCount }, (_, j) =>
    line(products[(i + j) % products.length], 20 + ((i + j) * 7) % 180)
  );

  bulkOrders.push({
    id: `po-${String(i + 8).padStart(3, '0')}`,
    supplierId,
    branchId,
    currency,
    status,
    // Fechas descendentes desde el 05/08/2026, un dia menos por orden —
    // no necesitan ser relativas a "hoy" (a diferencia de clientes/
    // logistica): nada en Compras calcula antiguedad ni tramos.
    createdAt: new Date(Date.UTC(2026, 7, 5 - i, 10, 0, 0)).toISOString(),
    lines,
  });
}

PURCHASE_ORDERS_MOCK_DATA.push(...bulkOrders);
