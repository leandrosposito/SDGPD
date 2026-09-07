// ============================================================
// Smoke script — ADR-009 (alcance del dashboard elegido por el
// usuario). Ejercita filterOrdersForBranch, la funcion PURA que
// resuelve "que pedidos pertenecen a una sucursal" via la relacion
// real con Delivery (Order no tiene branchId propio). Importa el
// codigo real, no una copia.
//
// Correr con: node scripts/smoke/adr-009.smoke.mjs (desde FrontEnd/).
// ============================================================

import { filterOrdersForBranch } from '../../src/modules/dashboard/api/dashboardAggregates.ts';
import { asOrderId, asBranchId } from '../../src/shared/types/ids.types.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const branchCentro = asBranchId('branch-001');
const branchNorte = asBranchId('branch-002');

const ordA = { id: asOrderId('ord-001'), label: 'A' };
const ordB = { id: asOrderId('ord-002'), label: 'B' };
const ordC = { id: asOrderId('ord-003'), label: 'C (sin entregas)' };
const ordD = { id: asOrderId('ord-004'), label: 'D (multi-sucursal)' };

const orders = [ordA, ordB, ordC, ordD];

const links = [
  { orderId: ordA.id, branchId: branchCentro },
  { orderId: ordB.id, branchId: branchNorte },
  // ordC: sin ningun link (sin entregas asociadas).
  { orderId: ordD.id, branchId: branchCentro },
  { orderId: ordD.id, branchId: branchNorte },
];

// Caso 1: filtro por sucursal A devuelve solo los pedidos de A.
const inCentro = filterOrdersForBranch(orders, links, branchCentro);
check('branch-001 incluye ord-001 (A)', inCentro.some((o) => o.id === ordA.id));
check('branch-001 NO incluye ord-002 (B, es de branch-002)', !inCentro.some((o) => o.id === ordB.id));
check('branch-001 NO incluye ord-003 (sin entregas)', !inCentro.some((o) => o.id === ordC.id));

// Caso 2: filtro por sucursal B devuelve solo los pedidos de B.
const inNorte = filterOrdersForBranch(orders, links, branchNorte);
check('branch-002 incluye ord-002 (B)', inNorte.some((o) => o.id === ordB.id));
check('branch-002 NO incluye ord-001 (A, es de branch-001)', !inNorte.some((o) => o.id === ordA.id));

// Caso 3: un pedido con entregas en 2 sucursales distintas aparece en
// el filtrado de AMBAS (reintentos/redespacho — es lo honesto).
check('ord-004 (multi-sucursal) aparece en branch-001', inCentro.some((o) => o.id === ordD.id));
check('ord-004 (multi-sucursal) aparece en branch-002', inNorte.some((o) => o.id === ordD.id));

// Caso 4: un pedido sin ninguna entrega asociada no aparece en NINGUN
// filtro por sucursal (es un caso distinto de "toda la empresa sin
// filtro", que no pasa por esta funcion).
check('ord-003 (sin entregas) no aparece en ningun filtro por sucursal', !inCentro.includes(ordC) && !inNorte.includes(ordC));

// Caso 5: sucursal sin ningun pedido asociado -> array vacio, no lanza.
const branchSur = asBranchId('branch-003');
const inSur = filterOrdersForBranch(orders, links, branchSur);
check('sucursal sin pedidos asociados devuelve array vacio', inSur.length === 0);

// Conteos exactos, no solo "incluye/no incluye".
check('branch-001 tiene exactamente 2 pedidos (A y D)', inCentro.length === 2);
check('branch-002 tiene exactamente 2 pedidos (B y D)', inNorte.length === 2);

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
} else {
  console.log('Todas las verificaciones pasaron.');
  process.exit(0);
}
