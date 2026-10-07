// ============================================================
// Smoke script — Tanda 17 (ADR-015: hallazgo de Tanda 16 a medias,
// ClientAccount.isActive se persistia pero nadie lo leia). Ejercita
// la logica PURA de shared/utils/orderEligibility.ts, unica fuente de
// la regla que usan CreateOrderModal (filtro del selector + texto del
// toast) y orders.service.ts#createOrder (rechazo server-side).
//
// Lo que NO cubre (sin framework de testing, regla 2.3): el camino
// httpClient de createOrder/getClientById y la invalidacion de cache
// — cubierto por tsc/build/lint + lectura de codigo + el checklist de
// VERIFICACION_TANDA_17.md.
//
// Correr con: node scripts/smoke/tanda-17.smoke.mjs (desde FrontEnd/).
// ============================================================

import {
  isClientSelectableForOrder,
  getCreateOrderBlockReason,
  describeCreateOrderReason,
} from '../../src/shared/utils/orderEligibility.ts';

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

const ACTIVE = { isActive: true };
const INACTIVE = { isActive: false };

console.log('--- isClientSelectableForOrder: filtro del selector ---');
check('un cliente activo es elegible', isClientSelectableForOrder(ACTIVE) === true);
check('un cliente dado de baja NO es elegible', isClientSelectableForOrder(INACTIVE) === false);
const catalog = [
  { id: 'cli-001', isActive: true },
  { id: 'cli-002', isActive: false },
  { id: 'cli-003', isActive: true },
];
const selectable = catalog.filter(isClientSelectableForOrder);
check('filtrar el catalogo deja solo los 2 activos', selectable.length === 2 && selectable.every((c) => c.id !== 'cli-002'));

console.log('');
console.log('--- getCreateOrderBlockReason: rechazo server-side ---');
check('pedido valido -> null', getCreateOrderBlockReason({ itemCount: 2, client: ACTIVE, hasInactiveProduct: false }) === null);
check('sin items -> no-items', getCreateOrderBlockReason({ itemCount: 0, client: ACTIVE, hasInactiveProduct: false }) === 'no-items');
check('cliente inexistente -> client-not-found', getCreateOrderBlockReason({ itemCount: 1, client: null, hasInactiveProduct: false }) === 'client-not-found');
check('cliente dado de baja -> inactive-client', getCreateOrderBlockReason({ itemCount: 1, client: INACTIVE, hasInactiveProduct: false }) === 'inactive-client');
check('producto dado de baja -> inactive-product', getCreateOrderBlockReason({ itemCount: 1, client: ACTIVE, hasInactiveProduct: true }) === 'inactive-product');

console.log('');
console.log('--- Precedencia de motivos ---');
check('sin items gana sobre cliente inexistente', getCreateOrderBlockReason({ itemCount: 0, client: null, hasInactiveProduct: true }) === 'no-items');
check('cliente inactivo gana sobre producto inactivo', getCreateOrderBlockReason({ itemCount: 3, client: INACTIVE, hasInactiveProduct: true }) === 'inactive-client');

console.log('');
console.log('--- describeCreateOrderReason: texto del toast ---');
const reasons = ['no-items', 'client-not-found', 'inactive-client', 'inactive-product'];
check('los 4 motivos tienen texto no vacio', reasons.every((r) => typeof describeCreateOrderReason(r) === 'string' && describeCreateOrderReason(r).length > 0));
check('inactive-client menciona la baja', describeCreateOrderReason('inactive-client').includes('dado de baja'));
check('inactive-product incluye el detalle del servidor', describeCreateOrderReason('inactive-product', '"Yerba" (YER-1K)').includes('"Yerba" (YER-1K)'));
check('inactive-product sin detalle tiene texto generico', describeCreateOrderReason('inactive-product').includes('Quitalo'));

console.log('');
if (failures > 0) {
  console.log(`${failures} chequeo(s) fallaron.`);
  process.exit(1);
}
console.log('Todos los chequeos pasaron.');
