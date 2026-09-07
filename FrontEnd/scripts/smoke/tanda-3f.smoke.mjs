// ============================================================
// Smoke script — Tanda 3f (cierra la migracion de Reposicion a la
// capa api/). Ejercita la logica PURA de filtro/orden/paginado de
// purchase-suggestions.service.ts (extraida a filterSort.ts porque
// httpClient.ts lee `import.meta.env` a nivel de modulo, inexistente
// bajo `node` puro — mismo criterio ya usado en
// dashboardAggregates.ts/alertsCursor.ts, Tanda 7).
//
// Correr con: node scripts/smoke/tanda-3f.smoke.mjs (desde FrontEnd/).
// ============================================================

import { filterAndSortPurchaseSuggestions, paginateSuggestions } from '../../src/modules/inventory/api/purchase-suggestions/filterSort.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const MOCK_SUGGESTIONS = [
  { id: 'sug-1', producto_id: 'inv-001', sku: 'ACE-GIR-15', nombre_producto: 'Aceite Girasol 1.5L', nombre_proveedor: 'Distribuidora Norte', sucursal_id: 'branch-001', stock_actual: 5, stock_minimo: 20, cantidad_sugerida: 30, costo_estimado: 15000 },
  { id: 'sug-2', producto_id: 'inv-002', sku: 'YER-TAR-1K', nombre_producto: 'Yerba Taragui 1kg', nombre_proveedor: 'Yerbatera del Sur', sucursal_id: 'branch-001', stock_actual: 2, stock_minimo: 15, cantidad_sugerida: 25, costo_estimado: 40000 },
  { id: 'sug-3', producto_id: 'inv-003', sku: 'GAL-SUR-200', nombre_producto: 'Galletitas Surtidas 200g', nombre_proveedor: 'Alimentos SA', sucursal_id: 'branch-002', stock_actual: 8, stock_minimo: 10, cantidad_sugerida: 10, costo_estimado: 4500 },
  { id: 'sug-4', producto_id: 'inv-004', sku: 'ACE-OLI-05', nombre_producto: 'Aceite Oliva 500ml', nombre_proveedor: 'Distribuidora Norte', sucursal_id: 'branch-002', stock_actual: 1, stock_minimo: 8, cantidad_sugerida: 12, costo_estimado: 33600 },
];

// --- Filtro por sucursal: branch-001 y branch-002 no se mezclan ---
const branch1 = filterAndSortPurchaseSuggestions(MOCK_SUGGESTIONS, { empresaId: 'emp-1', branchId: 'branch-001' }, undefined);
check('branch-001 devuelve solo sus 2 sugerencias', branch1.length === 2);
check('branch-001 no incluye sugerencias de branch-002', branch1.every((s) => s.sucursal_id === 'branch-001'));

const branch2 = filterAndSortPurchaseSuggestions(MOCK_SUGGESTIONS, { empresaId: 'emp-1', branchId: 'branch-002' }, undefined);
check('branch-002 devuelve solo sus 2 sugerencias', branch2.length === 2);
check('branch-002 no incluye sugerencias de branch-001', branch2.every((s) => s.sucursal_id === 'branch-002'));

const branchInexistente = filterAndSortPurchaseSuggestions(MOCK_SUGGESTIONS, { empresaId: 'emp-1', branchId: 'branch-999' }, undefined);
check('sucursal sin sugerencias devuelve array vacio, no lanza', branchInexistente.length === 0);

// --- Orden default: currentStock ascendente (mayor urgencia primero) ---
const allInOne = filterAndSortPurchaseSuggestions(
  [...MOCK_SUGGESTIONS.map((s) => ({ ...s, sucursal_id: 'branch-x' }))],
  { empresaId: 'emp-1', branchId: 'branch-x' },
  undefined
);
check('orden default es por stock_actual ascendente', allInOne[0].stock_actual <= allInOne[allInOne.length - 1].stock_actual);
check('orden default: el de menor stock (sug-4, stock 1) va primero', allInOne[0].id === 'sug-4');

// --- Orden explicito por costo, descendente ---
const byCostDesc = filterAndSortPurchaseSuggestions(
  [...MOCK_SUGGESTIONS.map((s) => ({ ...s, sucursal_id: 'branch-y' }))],
  { empresaId: 'emp-1', branchId: 'branch-y' },
  { field: 'estimatedCost', direction: 'desc' }
);
check('orden por costo desc: el mas caro (sug-2, 40000) va primero', byCostDesc[0].id === 'sug-2');
check('orden por costo desc: el mas barato (sug-3, 4500) va ultimo', byCostDesc[byCostDesc.length - 1].id === 'sug-3');

// --- Paginado ---
const page1 = paginateSuggestions(allInOne, 1, 2);
check('pagina 1 de pageSize 2 trae 2 items', page1.items.length === 2);
check('pagina 1 reporta total correcto (4)', page1.total === 4);
check('pagina 1 reporta page=1', page1.page === 1);

const page2 = paginateSuggestions(allInOne, 2, 2);
check('pagina 2 de pageSize 2 trae los 2 restantes', page2.items.length === 2);
check('pagina 1 y pagina 2 no se solapan', page1.items[0].id !== page2.items[0].id && page1.items[1].id !== page2.items[0].id);

const pageOutOfRange = paginateSuggestions(allInOne, 99, 2);
check('pedir una pagina fuera de rango devuelve la ultima pagina valida, no vacia', pageOutOfRange.items.length > 0);

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
} else {
  console.log('Todas las verificaciones pasaron.');
  process.exit(0);
}
