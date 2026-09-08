// ============================================================
// V-ADR009 (verificacion adversarial, sesion 2026-09-08) — recorre
// TODOS los pedidos y TODAS las entregas del mock real y confirma,
// contra los datos reales (no una copia ni un fixture sintetico), la
// relacion pedido<->sucursal que usa la seccion "Reconciliacion" de
// ADR-009-alcance-dashboard.md.
//
// Por que existe: la primera version de esa seccion (adenda
// 2026-09-08) afirmaba que "ord-003 no tiene ninguna Delivery
// asociada", citando el smoke script de ADR-009 como evidencia. Ese
// smoke script (scripts/smoke/adr-009.smoke.mjs) es real y esta bien,
// pero ejercita `filterOrdersForBranch` con un FIXTURE SINTETICO
// propio (ordA/ordB/ordC/ordD, no las 6 ordenes reales del mock) —
// que un pedido de ese fixture se llame "ord-003" no prueba nada sobre
// el ord-003 real. Al correr esta verificacion contra
// src/data/mock/orders.data.ts + logistics.data.ts reales, ord-003
// SI tiene 3 entregas (branch-002 x2, branch-003 x1) — la afirmacion
// original era falsa. Este script deja la comprobacion automatizada
// para que no vuelva a pasar desapercibido.
//
// Importa los MOCKS REALES via el mismo resolve hook minimo que usan
// v2/v11 (mapea `@/` a `src/`, sin dependencias nuevas).
//
// Correr con: node scripts/verificacion/v-adr009-order-branch-links.mjs
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

const { ORDERS_MOCK_DATA } = await import('../../src/data/mock/orders.data.ts');
const { LOGISTICS_MOCK_DATA } = await import('../../src/data/mock/logistics.data.ts');
const { filterOrdersForBranch } = await import('../../src/modules/dashboard/api/dashboardAggregates.ts');

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const links = LOGISTICS_MOCK_DATA.map((d) => ({ orderId: d.orderId, branchId: d.branchId }));

const byOrder = new Map();
for (const l of links) {
  if (!byOrder.has(l.orderId)) byOrder.set(l.orderId, new Set());
  byOrder.get(l.orderId).add(l.branchId);
}

console.log(`Pedidos en el mock: ${ORDERS_MOCK_DATA.length}`);
console.log(`Entregas en el mock: ${LOGISTICS_MOCK_DATA.length}`);
console.log('');

for (const order of ORDERS_MOCK_DATA) {
  const branches = byOrder.get(order.id);
  console.log(`${order.id} -> ${branches ? [...branches].sort().join(', ') : '(sin entregas)'}`);
}
console.log('');

// Hallazgo de esta sesion: en el mock ACTUAL ningun pedido tiene cero
// entregas — los 6 ya fueron despachados desde 2 o 3 sucursales cada
// uno. El caso "pedido sin entregas desaparece de toda vista por
// sucursal" es real en el CODIGO (filterOrdersForBranch, cubierto por
// el fixture sintetico de adr-009.smoke.mjs, y ocurre con cualquier
// pedido recien creado antes de que Logistica genere su primera
// entrega — createOrder en orders.service.ts no crea ninguna Delivery)
// pero NO esta representado hoy por ningun pedido semilla del mock.
// Este check documenta ese hecho en vez de asumirlo.
const zeroDeliveryOrders = ORDERS_MOCK_DATA.filter((o) => !byOrder.has(o.id) || byOrder.get(o.id).size === 0);
check(
  'ningun pedido semilla del mock tiene cero entregas hoy (si esto falla, la seccion "Reconciliacion" de ADR-009 sobre pedidos sin despachar dejo de ser solo teorica y hay que actualizar el ADR con el caso real)',
  zeroDeliveryOrders.length === 0
);

// Doble conteo (punto (a) de la tarea): ord-004 tiene entregas reales
// en 2 sucursales (branch-001 y branch-003) — confirma el ejemplo que
// cita ADR-009.
check(
  'ord-004 tiene entregas reales en branch-001 y branch-003 (ejemplo de doble conteo citado por ADR-009)',
  byOrder.get('ord-004')?.has('branch-001') && byOrder.get('ord-004')?.has('branch-003')
);

// Consistencia cruzada: usar la funcion PURA real (no una reimplementacion)
// para confirmar que el resultado por sucursal coincide con el link
// crudo, para las 3 sucursales reales del mock.
for (const branchId of ['branch-001', 'branch-002', 'branch-003']) {
  const viaFn = filterOrdersForBranch(
    ORDERS_MOCK_DATA.map((o) => ({ id: o.id })),
    links,
    branchId
  ).map((o) => o.id);
  const expected = ORDERS_MOCK_DATA.filter((o) => byOrder.get(o.id)?.has(branchId)).map((o) => o.id);
  check(
    `filterOrdersForBranch(${branchId}) sobre datos reales coincide con el link crudo (${expected.length} pedidos)`,
    viaFn.length === expected.length && expected.every((id) => viaFn.includes(id))
  );
}

// Suma de "pedidos por sucursal" (union de las 3 vistas, contando cada
// pedido una vez por sucursal en la que aparece) siempre >= total de
// empresa cuando todo pedido tiene entregas en 2+ sucursales, nunca al
// reves mientras no exista ningun pedido con 0 entregas en el mock.
const totalPorSucursalSumado = ['branch-001', 'branch-002', 'branch-003'].reduce(
  (sum, b) => sum + ORDERS_MOCK_DATA.filter((o) => byOrder.get(o.id)?.has(b)).length,
  0
);
check(
  `sumar "pedidos por sucursal" de las 3 sucursales (${totalPorSucursalSumado}) da MAS que el total de empresa (${ORDERS_MOCK_DATA.length}), nunca menos, mientras cada pedido semilla tenga 2+ entregas`,
  totalPorSucursalSumado > ORDERS_MOCK_DATA.length
);

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
} else {
  console.log('Todas las verificaciones pasaron.');
  process.exit(0);
}
