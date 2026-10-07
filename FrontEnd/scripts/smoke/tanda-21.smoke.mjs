// ============================================================
// Smoke script — Tanda 21 (PENDIENTES.md item 19, parte validacion;
// enmienda de ADR-015). createOrder dejaba pasar en silencio un sku que
// no existe en el catalogo. Ejercita la logica PURA de
// shared/utils/orderEligibility.ts: el motivo nuevo 'product-not-found',
// su precedencia y su texto.
//
// El camino real (createOrder contra el store del mock) lo cubre
// scripts/verificacion/v17-clientes-inactivos.mjs.
//
// Correr con: node scripts/smoke/tanda-21.smoke.mjs (desde FrontEnd/).
// ============================================================

import { getCreateOrderBlockReason, describeCreateOrderReason } from '../../src/shared/utils/orderEligibility.ts';

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
const base = { itemCount: 2, client: ACTIVE, hasUnknownProduct: false, hasInactiveProduct: false };

console.log('--- product-not-found ---');
check('pedido valido -> null', getCreateOrderBlockReason(base) === null);
check('sku desconocido -> product-not-found', getCreateOrderBlockReason({ ...base, hasUnknownProduct: true }) === 'product-not-found');

console.log('');
console.log('--- Precedencia ---');
check('product-not-found gana sobre inactive-product (un producto que no existe no tiene estado)',
  getCreateOrderBlockReason({ ...base, hasUnknownProduct: true, hasInactiveProduct: true }) === 'product-not-found');
check('inactive-client gana sobre product-not-found', getCreateOrderBlockReason({ ...base, client: INACTIVE, hasUnknownProduct: true }) === 'inactive-client');
check('client-not-found gana sobre product-not-found', getCreateOrderBlockReason({ ...base, client: null, hasUnknownProduct: true }) === 'client-not-found');
check('no-items gana sobre todo', getCreateOrderBlockReason({ itemCount: 0, client: null, hasUnknownProduct: true, hasInactiveProduct: true }) === 'no-items');
check('inactive-product sigue funcionando solo', getCreateOrderBlockReason({ ...base, hasInactiveProduct: true }) === 'inactive-product');

console.log('');
console.log('--- describeCreateOrderReason ---');
check('product-not-found incluye el detalle del servidor', describeCreateOrderReason('product-not-found', '"X" (SKU-NO-EXISTE)').includes('SKU-NO-EXISTE'));
check('product-not-found dice que no existe', describeCreateOrderReason('product-not-found').includes('no existe en el catalogo'));
check('product-not-found y inactive-product tienen textos distintos',
  describeCreateOrderReason('product-not-found') !== describeCreateOrderReason('inactive-product'));

console.log('');
if (failures > 0) {
  console.log(`${failures} chequeo(s) fallaron.`);
  process.exit(1);
}
console.log('Todos los chequeos pasaron.');
