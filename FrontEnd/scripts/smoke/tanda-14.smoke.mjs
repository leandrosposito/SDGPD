// ============================================================
// Smoke script — Tanda 14 (hallazgo Tanda 12 a medias: productos
// 'inactive' seguian apareciendo en selectores de pedido/OC, Bajo
// Stock Minimo, su KPI y las sugerencias de reposicion). Ejercita la
// funcion PURA que gano un parametro nuevo en esta tanda (sin
// httpClient): filterAndSortPurchaseSuggestions
// (modules/inventory/api/purchase-suggestions/filterSort.ts).
//
// El resto de la tanda es: (a) filtros de un `if`/`.filter()` sobre
// datos ya en memoria del mock (CreateOrderModal, PurchaseOrderFormModal,
// createOrder, createPurchaseOrder, generatePurchaseOrderFromSuggestion,
// filterAndSortLowStock) — mismo criterio que Tanda 12/13: cubierto por
// tsc/build/lint + lectura de codigo + el checklist de navegador de
// VERIFICACION_TANDA_14.md, no amerita extraerse; (b) products.service.ts
// no expone su logica pura fuera de httpClient (isBelowMinStock/
// computeStockAggregates/filterAndSortLowStock nunca se extrajeron a un
// archivo sin import.meta.env en tandas anteriores, y extraerlas ahora
// solo para esta tanda seria una refactorizacion no pedida).
//
// Correr con: node scripts/smoke/tanda-14.smoke.mjs (desde FrontEnd/).
// ============================================================

import { filterAndSortPurchaseSuggestions } from '../../src/modules/inventory/api/purchase-suggestions/filterSort.ts';

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const SUGGESTIONS = [
  { id: 'sug-1', producto_id: 'inv-001', sku: 'ACE-GIR-15', nombre_producto: 'Aceite Girasol 1.5L', nombre_proveedor: 'Distribuidora Norte', sucursal_id: 'branch-001', stock_actual: 5, stock_minimo: 20, cantidad_sugerida: 30, costo_estimado: 15000 },
  { id: 'sug-2', producto_id: 'inv-002', sku: 'YER-TAR-1K', nombre_producto: 'Yerba Taragui 1kg', nombre_proveedor: 'Yerbatera del Sur', sucursal_id: 'branch-001', stock_actual: 2, stock_minimo: 15, cantidad_sugerida: 25, costo_estimado: 40000 },
  { id: 'sug-3', producto_id: 'inv-003', sku: 'GAL-SUR-200', nombre_producto: 'Galletitas Surtidas 200g', nombre_proveedor: 'Alimentos SA', sucursal_id: 'branch-001', stock_actual: 8, stock_minimo: 10, cantidad_sugerida: 10, costo_estimado: 4500 },
];

// --- Sin activeProductIds (compat con el smoke de Tanda 3f y con
// cualquier llamador que no necesite filtrar por estado): comportamiento
// identico a antes de esta tanda. ---
console.log('--- Sin activeProductIds: no filtra por estado (compat hacia atras) ---');
const sinFiltro = filterAndSortPurchaseSuggestions(SUGGESTIONS, { empresaId: 'emp-1', branchId: 'branch-001' }, undefined);
check('devuelve las 3 sugerencias de la sucursal', sinFiltro.length === 3);

// --- Con activeProductIds: excluye sugerencias de productos dados de
// baja (inv-002 inactivo, ausente del set de productos activos). ---
console.log('');
console.log('--- Con activeProductIds: excluye productos inactivos ---');
const activeIds = new Set(['inv-001', 'inv-003']); // inv-002 dado de baja
const conFiltro = filterAndSortPurchaseSuggestions(SUGGESTIONS, { empresaId: 'emp-1', branchId: 'branch-001' }, undefined, activeIds);
check('excluye la sugerencia del producto inactivo (inv-002)', conFiltro.every((s) => s.producto_id !== 'inv-002'));
check('deja las 2 sugerencias de productos activos', conFiltro.length === 2);
check('el orden default (currentStock asc) se mantiene sobre el subconjunto filtrado', conFiltro[0].id === 'sug-1' && conFiltro[1].id === 'sug-3');

// --- Set vacio: ningun producto activo -> ninguna sugerencia. ---
console.log('');
console.log('--- activeProductIds vacio: ninguna sugerencia sobrevive ---');
const ninguno = filterAndSortPurchaseSuggestions(SUGGESTIONS, { empresaId: 'emp-1', branchId: 'branch-001' }, undefined, new Set());
check('set vacio de activos devuelve array vacio, no lanza', ninguno.length === 0);

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
} else {
  console.log('Todas las verificaciones pasaron.');
  process.exit(0);
}
