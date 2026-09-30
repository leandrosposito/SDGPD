// ============================================================
// V16 (Fase D2, sesion avance-2026-09-30) — integridad referencial de
// los mocks que tocan las Tandas 2 (lotes) y 4 (joins por Map en
// Reposicion). Importa los mocks REALES (mismo resolve hook de @/ que
// v11..v14), no copias.
//
// Invariantes:
//   1. ids de productos unicos (con ids duplicados, .find() devolvia el
//      PRIMERO y Map.get devuelve el ULTIMO — la Tanda 4 solo es
//      equivalente si no hay duplicados).
//   2. ids de proveedores unicos (mismo motivo).
//   3. todo product.supplierId resuelve a un proveedor real, o se lista
//      como el caso "sin proveedor valido" que TabPurchases rechaza con
//      toast (no es FAIL: es un camino de UI previsto, se informa).
//   4. toda sugerencia de reposicion apunta a un producto real y a una
//      sucursal real de la sesion.
//   5. ids de lote unicos en todo el catalogo (los lotes conservados por
//      mergeProductUpdate no pueden chocar con los de otro producto).
//   6. todo lote tiene cantidad entera >= 0 y fecha ISO parseable.
//
// Correr con: node scripts/verificacion/v16-avance-2026-09-30-integrity.mjs
// (desde FrontEnd/).
// ============================================================

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const srcBase = new URL('../../src/', import.meta.url).href;
const loaderSource = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      let mapped = ${JSON.stringify(srcBase)} + specifier.slice(2);
      if (!/\\.(ts|tsx|js|jsx|mjs|json|css)$/i.test(mapped)) mapped += '.ts';
      return nextResolve(mapped, context);
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, pathToFileURL('./'));

const { INVENTORY_MOCK_DATA } = await import('../../src/data/mock/inventory.data.ts');
const { SUPPLIERS_MOCK_DATA } = await import('../../src/data/mock/suppliers.data.ts');
const { SESSION_MOCK_DATA } = await import('../../src/data/mock/session.mock.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}
function info(description) {
  console.log(`INFO ${description}`);
}

function duplicates(ids) {
  const seen = new Set();
  const dups = new Set();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups];
}

const products = INVENTORY_MOCK_DATA.items;
const suggestions = INVENTORY_MOCK_DATA.suggestions;
const suppliers = SUPPLIERS_MOCK_DATA;
const branchIds = new Set(SESSION_MOCK_DATA.branches.map((b) => b.id));

console.log(
  `Productos: ${products.length} | Proveedores: ${suppliers.length} | Sugerencias: ${suggestions.length} | Sucursales: ${branchIds.size}`
);
console.log('');

// 1 y 2
const dupProducts = duplicates(products.map((p) => p.id));
check(`ids de producto unicos (duplicados: ${dupProducts.join(',') || 'ninguno'})`, dupProducts.length === 0);
const dupSuppliers = duplicates(suppliers.map((s) => s.id));
check(`ids de proveedor unicos (duplicados: ${dupSuppliers.join(',') || 'ninguno'})`, dupSuppliers.length === 0);

// 3
const supplierIds = new Set(suppliers.map((s) => s.id));
const orphanSupplier = products.filter((p) => !supplierIds.has(p.supplierId));
for (const p of products) {
  if (supplierIds.has(p.supplierId)) {
    check(`${p.id}: supplierId "${p.supplierId}" resuelve`, true);
  }
}
for (const p of orphanSupplier) {
  info(`${p.id} (${p.name}): supplierId "${p.supplierId}" NO resuelve -> "Generar OC" lo rechaza con toast (camino O9 previsto)`);
}

// 4
const productIds = new Set(products.map((p) => p.id));
for (const s of suggestions) {
  check(`sugerencia ${s.id}: productId "${s.productId}" resuelve a un producto`, productIds.has(s.productId));
  check(`sugerencia ${s.id}: branchId "${s.branchId}" es una sucursal de la sesion`, branchIds.has(s.branchId));
}

// 5 y 6
const allLots = products.flatMap((p) => (p.lots ?? []).map((l) => ({ ...l, productId: p.id })));
const dupLots = duplicates(allLots.map((l) => l.id));
check(`ids de lote unicos en todo el catalogo (${allLots.length} lotes; duplicados: ${dupLots.join(',') || 'ninguno'})`, dupLots.length === 0);
for (const l of allLots) {
  check(
    `lote ${l.id} (${l.productId}): cantidad entera >= 0 y vencimiento parseable`,
    Number.isInteger(l.quantity) && l.quantity >= 0 && !Number.isNaN(Date.parse(l.expirationDate))
  );
}
const withLots = products.filter((p) => (p.lots ?? []).length > 0).map((p) => p.id);
info(`productos con lotes (candidatos para el checklist de la Tanda 2): ${withLots.join(', ')}`);

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) de integridad fallaron.`);
  process.exit(1);
}
console.log('Integridad referencial OK.');
