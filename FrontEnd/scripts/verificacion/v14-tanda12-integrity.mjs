// ============================================================
// V14 (verificacion adversarial de Tanda 12) — integridad de los
// mocks tocados. Importa los mocks reales (mismo resolve hook de @/
// que v11/v12/v13, no se reimplementan los datos).
//
// Relaciones/invariantes verificados:
//   1. Los 30 clientes del seed tienen priceList/saleCondition no
//      vacios (backfill de la Tanda 12 completo, ningun cliente quedo
//      con el campo undefined pese a ser obligatorio en el tipo).
//   2. CUITs del seed de proveedores unicos entre si (la base sobre la
//      que createSupplier/updateSupplier ahora validan unicidad).
//   3. Ningun pedido del seed esta en un estado que la regla nueva de
//      cancelOrder rechazaria si Leandro intentara cancelarlo desde el
//      navegador con datos "limpios" (no es una violacion posible del
//      seed en si — es solo para dejar a la vista que estados hay en
//      el mock, util para que Leandro sepa contra que pedido probar el
//      checklist de VERIFICACION_TANDA_12.md).
//
// Correr con: node scripts/verificacion/v14-tanda12-integrity.mjs
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

const { CLIENTS_MOCK_DATA } = await import('../../src/data/mock/clients.data.ts');
const { SUPPLIERS_MOCK_DATA } = await import('../../src/data/mock/suppliers.data.ts');
const { ORDERS_MOCK_DATA } = await import('../../src/data/mock/orders.data.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

function normalizeCuitForComparison(raw) {
  return raw.replace(/[^0-9]/g, '');
}

console.log(`Clientes: ${CLIENTS_MOCK_DATA.length} | Proveedores: ${SUPPLIERS_MOCK_DATA.length} | Pedidos: ${ORDERS_MOCK_DATA.length}`);
console.log('');

// 1. Backfill de priceList/saleCondition
console.log('--- Clientes: priceList/saleCondition backfilleados ---');
for (const c of CLIENTS_MOCK_DATA) {
  check(`${c.id}: priceList no vacio ("${c.priceList}")`, typeof c.priceList === 'string' && c.priceList.length > 0);
  check(`${c.id}: saleCondition no vacio ("${c.saleCondition}")`, typeof c.saleCondition === 'string' && c.saleCondition.length > 0);
}

// 2. CUITs unicos en el seed de proveedores
console.log('');
console.log('--- Proveedores: CUIT unico en el seed (normalizado) ---');
const cuitsVistos = new Set();
for (const s of SUPPLIERS_MOCK_DATA) {
  const normalizado = normalizeCuitForComparison(s.cuit);
  check(`${s.id}: CUIT "${s.cuit}" es unico en el seed`, !cuitsVistos.has(normalizado));
  cuitsVistos.add(normalizado);
}

// 3. Informativo: distribucion de estados de pedidos del seed
console.log('');
console.log('--- Pedidos: estados presentes en el seed (informativo, para el checklist de navegador) ---');
const NON_CANCELLABLE = new Set(['delivered', 'invoiced', 'cancelled']);
for (const o of ORDERS_MOCK_DATA) {
  const bloqueado = NON_CANCELLABLE.has(o.status);
  console.log(`     ${o.id} (${o.orderNumber}): status="${o.status}" -> cancelOrder ${bloqueado ? 'RECHAZARIA (invalid-status-for-cancel)' : 'lo permite (sujeto a entregas activas)'}`);
}
check('hay al menos un pedido del seed en un estado NO cancelable (para probar el rechazo)', ORDERS_MOCK_DATA.some((o) => NON_CANCELLABLE.has(o.status)));
check('hay al menos un pedido del seed en un estado SI cancelable (para probar el camino feliz)', ORDERS_MOCK_DATA.some((o) => !NON_CANCELLABLE.has(o.status)));

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) de integridad fallaron.`);
  process.exit(1);
} else {
  console.log('Toda la integridad verificada paso.');
  process.exit(0);
}
