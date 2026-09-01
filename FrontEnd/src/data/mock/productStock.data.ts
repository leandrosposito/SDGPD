import type { ProductStock } from '@/shared/types/inventory.types';

// ============================================================
// MOCK DATA — ProductStock (stock y minimo por producto x sucursal)
// Archivo aparte de inventory.data.ts (E1, DECISIONES_TECNICAS.md): el
// stock es una entidad de sucursal, no del catalogo de productos.
//
// Cobertura: solo las 3 sucursales ACTIVAS (branch-001/002/003). La 4ta
// (branch-004, inactiva) no tiene stock, igual que no tiene entregas en
// logistics.data.ts.
//
// Casos de borde a proposito (ver checklist de verificacion, E5/E6):
// - inv-001 (Aceite Girasol): sano en branch-001 (450/200) y en 0 en
//   branch-002 (0/180) — "sin stock aca" vs "sano en otra sucursal".
// - inv-008 (Fideos Guisero) e inv-009 (Arroz Largo Fino), en
//   branch-001: stock === minStock exacto (60/60, 90/90) — prueba E6
//   (bajo minimo pasa a ser stock <= minStock, no < estricto).
// - inv-018 (Vino Tinto) NO tiene registro en branch-003 (Sucursal Sur):
//   prueba E5 (producto no dado de alta en una sucursal, no error).
// - inv-002 (Yerba Mate) tiene minStock distinto en las 3 sucursales
//   (150 / 100 / 200) — prueba minStock independiente por sucursal.
// ============================================================

export const PRODUCT_STOCK_MOCK_DATA: ProductStock[] = [
  // --- branch-001 — Sucursal Centro ---
  { productId: 'inv-001', branchId: 'branch-001', stock: 450, minStock: 200 },
  { productId: 'inv-002', branchId: 'branch-001', stock: 50, minStock: 150 },
  { productId: 'inv-003', branchId: 'branch-001', stock: 80, minStock: 150 },
  { productId: 'inv-004', branchId: 'branch-001', stock: 40, minStock: 100 },
  { productId: 'inv-005', branchId: 'branch-001', stock: 30, minStock: 120 },
  { productId: 'inv-006', branchId: 'branch-001', stock: 12, minStock: 50 },
  { productId: 'inv-007', branchId: 'branch-001', stock: 25, minStock: 80 },
  { productId: 'inv-008', branchId: 'branch-001', stock: 60, minStock: 60 },
  { productId: 'inv-009', branchId: 'branch-001', stock: 90, minStock: 90 },
  { productId: 'inv-010', branchId: 'branch-001', stock: 300, minStock: 100 },
  { productId: 'inv-011', branchId: 'branch-001', stock: 200, minStock: 80 },
  { productId: 'inv-012', branchId: 'branch-001', stock: 5, minStock: 40 },
  { productId: 'inv-013', branchId: 'branch-001', stock: 15, minStock: 60 },
  { productId: 'inv-014', branchId: 'branch-001', stock: 8, minStock: 50 },
  { productId: 'inv-015', branchId: 'branch-001', stock: 500, minStock: 150 },
  { productId: 'inv-016', branchId: 'branch-001', stock: 3, minStock: 100 },
  { productId: 'inv-017', branchId: 'branch-001', stock: 400, minStock: 200 },
  { productId: 'inv-018', branchId: 'branch-001', stock: 0, minStock: 30 },

  // --- branch-002 — Sucursal Norte ---
  { productId: 'inv-001', branchId: 'branch-002', stock: 0, minStock: 180 },
  { productId: 'inv-002', branchId: 'branch-002', stock: 80, minStock: 100 },
  { productId: 'inv-003', branchId: 'branch-002', stock: 56, minStock: 120 },
  { productId: 'inv-004', branchId: 'branch-002', stock: 28, minStock: 80 },
  { productId: 'inv-005', branchId: 'branch-002', stock: 21, minStock: 96 },
  { productId: 'inv-006', branchId: 'branch-002', stock: 8, minStock: 40 },
  { productId: 'inv-007', branchId: 'branch-002', stock: 18, minStock: 64 },
  { productId: 'inv-008', branchId: 'branch-002', stock: 42, minStock: 48 },
  { productId: 'inv-009', branchId: 'branch-002', stock: 63, minStock: 72 },
  { productId: 'inv-010', branchId: 'branch-002', stock: 210, minStock: 80 },
  { productId: 'inv-011', branchId: 'branch-002', stock: 140, minStock: 64 },
  { productId: 'inv-012', branchId: 'branch-002', stock: 4, minStock: 32 },
  { productId: 'inv-013', branchId: 'branch-002', stock: 11, minStock: 48 },
  { productId: 'inv-014', branchId: 'branch-002', stock: 6, minStock: 40 },
  { productId: 'inv-015', branchId: 'branch-002', stock: 350, minStock: 120 },
  { productId: 'inv-016', branchId: 'branch-002', stock: 2, minStock: 80 },
  { productId: 'inv-017', branchId: 'branch-002', stock: 280, minStock: 160 },
  { productId: 'inv-018', branchId: 'branch-002', stock: 0, minStock: 30 },

  // --- branch-003 — Sucursal Sur ---
  { productId: 'inv-001', branchId: 'branch-003', stock: 300, minStock: 200 },
  { productId: 'inv-002', branchId: 'branch-003', stock: 190, minStock: 200 },
  { productId: 'inv-003', branchId: 'branch-003', stock: 40, minStock: 165 },
  { productId: 'inv-004', branchId: 'branch-003', stock: 20, minStock: 110 },
  { productId: 'inv-005', branchId: 'branch-003', stock: 15, minStock: 132 },
  { productId: 'inv-006', branchId: 'branch-003', stock: 6, minStock: 55 },
  { productId: 'inv-007', branchId: 'branch-003', stock: 13, minStock: 88 },
  { productId: 'inv-008', branchId: 'branch-003', stock: 30, minStock: 66 },
  { productId: 'inv-009', branchId: 'branch-003', stock: 45, minStock: 99 },
  { productId: 'inv-010', branchId: 'branch-003', stock: 150, minStock: 110 },
  { productId: 'inv-011', branchId: 'branch-003', stock: 100, minStock: 88 },
  { productId: 'inv-012', branchId: 'branch-003', stock: 3, minStock: 44 },
  { productId: 'inv-013', branchId: 'branch-003', stock: 8, minStock: 66 },
  { productId: 'inv-014', branchId: 'branch-003', stock: 4, minStock: 55 },
  { productId: 'inv-015', branchId: 'branch-003', stock: 250, minStock: 165 },
  { productId: 'inv-016', branchId: 'branch-003', stock: 2, minStock: 110 },
  { productId: 'inv-017', branchId: 'branch-003', stock: 200, minStock: 220 },
  // inv-018 (Vino Tinto): SIN registro en branch-003 a proposito (E5).
];
