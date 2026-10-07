// ============================================================
// V17 (Fase D de la sesion clientes-inactivos-2026-10-07, Tandas 17-18).
//
// D2, integridad de los mocks que toca la sesion (importa los mocks
// REALES, mismo resolve de @/ que v11..v16):
//   1. Los 30 clientes tienen isActive boolean (lo que el selector y
//      createOrder leen ahora).
//   2. Todo Order.clientId del seed resuelve a un cliente — si no,
//      getClientById devolveria null y el pedido quedaria sin cliente
//      en OrderDetailPanel.
//   3. Todo sku de linea de pedido del seed resuelve a un producto.
//
// D1, adversarial: ejecuta createOrder/getClientById/updateClient
// REALES (no copias) contra el store en memoria del mock. Para poder
// importar httpClient fuera de Vite, el loader reemplaza
// `import.meta.env` por un objeto fijo (latencia 0, tasa de falla 0)
// — no cambia ninguna logica del codigo bajo prueba, solo su config.
//
// Correr con: node scripts/verificacion/v17-clientes-inactivos.mjs
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
    // Imports relativos sin extension dentro de src/ (ej. httpClient.ts
    // -> './ApiError'): Vite los resuelve, Node no.
    if (specifier.startsWith('.') && !/\\.(ts|tsx|js|jsx|mjs|json|css)$/i.test(specifier) && context.parentURL?.startsWith(${JSON.stringify(srcBase)})) {
      return nextResolve(specifier + '.ts', context);
    }
    return nextResolve(specifier, context);
  }
  export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url.startsWith(${JSON.stringify(srcBase)}) && result.source) {
      const text = typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source);
      if (text.includes('import.meta.env')) {
        const env = "({ VITE_API_MODE: 'mock', VITE_API_BASE_URL: '', VITE_MOCK_LATENCY_MS: '0', VITE_MOCK_FAILURE_RATE: '0', VITE_API_DEBUG: '' })";
        return { ...result, source: text.split('import.meta.env').join(env) };
      }
    }
    return result;
  }
`;
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, pathToFileURL('./'));

const { CLIENTS_MOCK_DATA } = await import('../../src/data/mock/clients.data.ts');
const { ORDERS_MOCK_DATA } = await import('../../src/data/mock/orders.data.ts');
const { INVENTORY_MOCK_DATA } = await import('../../src/data/mock/inventory.data.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

console.log(`Clientes: ${CLIENTS_MOCK_DATA.length} | Pedidos: ${ORDERS_MOCK_DATA.length} | Productos: ${INVENTORY_MOCK_DATA.items.length}`);
console.log('');

console.log('--- D2.1 isActive boolean en los clientes del seed ---');
const nonBoolean = CLIENTS_MOCK_DATA.filter((c) => typeof c.isActive !== 'boolean');
check(`los ${CLIENTS_MOCK_DATA.length} clientes tienen isActive boolean`, nonBoolean.length === 0);
console.log(`     informativo: ${CLIENTS_MOCK_DATA.filter((c) => !c.isActive).length} cliente(s) inactivo(s) en el seed`);

console.log('');
console.log('--- D2.2 Order.clientId -> cliente ---');
const clientIds = new Set(CLIENTS_MOCK_DATA.map((c) => c.id));
for (const o of ORDERS_MOCK_DATA) {
  check(`${o.id} (${o.orderNumber}): clientId ${o.clientId} existe`, clientIds.has(o.clientId));
}

console.log('');
console.log('--- D2.3 sku de linea de pedido -> producto ---');
const skus = new Set(INVENTORY_MOCK_DATA.items.map((p) => p.sku));
const orphanLines = ORDERS_MOCK_DATA.flatMap((o) => o.items.filter((i) => !skus.has(i.sku)).map((i) => `${o.id}/${i.sku}`));
check('toda linea de pedido del seed apunta a un sku existente', orphanLines.length === 0);
if (orphanLines.length > 0) console.log(`     huerfanas: ${orphanLines.join(', ')}`);

// ------------------------------------------------------------
// D1 adversarial: services reales.
// ------------------------------------------------------------
const { createOrder } = await import('../../src/modules/orders/api/orders.service.ts');
const { getClientById, updateClient, fetchClientsCatalog } = await import('../../src/modules/clients/api/clients.service.ts');
const { asClientId } = await import('../../src/shared/types/ids.types.ts');

const EMPRESA = 'company-001';
const target = CLIENTS_MOCK_DATA.find((c) => c.isActive);
const product = INVENTORY_MOCK_DATA.items.find((p) => p.status === 'active');

function orderInput(client) {
  return {
    clientId: client.id,
    clientName: client.clientName,
    clientAddress: client.address,
    clientZone: client.zone,
    sellerName: client.sellerName,
    paymentMethod: 'cash',
    subtotal: 100,
    discount: 0,
    tax: 21,
    totalAmount: 121,
    notes: '',
    items: [{ sku: product.sku, name: product.name, quantity: 1, unitPrice: 100, subtotal: 100 }],
  };
}

console.log('');
console.log('--- D1 createOrder contra el store real ---');
const ok = await createOrder(EMPRESA, orderInput(target));
check(`cliente activo ${target.id}: success true`, ok.success === true && ok.order.clientId === target.id);

const empty = await createOrder(EMPRESA, { ...orderInput(target), items: [] });
check('sin items: reason no-items (ya no throw)', empty.success === false && empty.reason === 'no-items');

const ghost = await createOrder(EMPRESA, { ...orderInput(target), clientId: asClientId('cli-no-existe') });
check('cliente inexistente: reason client-not-found', ghost.success === false && ghost.reason === 'client-not-found');

check('getClientById de un id inexistente devuelve null (no throw)', (await getClientById(EMPRESA, asClientId('cli-no-existe'))) === null);

// Dar de baja por el MISMO camino que la UI (updateClient con el
// formulario completo, isActive:false).
const { id: _id, totalDebit, totalCredit, currentBalance, daysOverdue, status, transactions, ...formInput } = target;
await updateClient(EMPRESA, target.id, { ...formInput, isActive: false });
check('updateClient persiste isActive=false', (await getClientById(EMPRESA, target.id))?.isActive === false);

const rejected = await createOrder(EMPRESA, orderInput(target));
check(`cliente dado de baja ${target.id}: reason inactive-client`, rejected.success === false && rejected.reason === 'inactive-client');

const catalog = await fetchClientsCatalog(EMPRESA);
check('fetchClientsCatalog SIGUE devolviendo al inactivo (OrderDetailPanel lo necesita, ADR-015 punto 1)', catalog.some((c) => c.id === target.id && c.isActive === false));

await updateClient(EMPRESA, target.id, { ...formInput, isActive: true });
const reactivated = await createOrder(EMPRESA, orderInput(target));
check('reactivado: vuelve a aceptar pedidos', reactivated.success === true);

// ADR-014: un rechazo no consume numero correlativo. Entre `ok` y
// `reactivated` hubo 3 rechazos (no-items, client-not-found,
// inactive-client) — los dos altas exitosas tienen que ser consecutivos.
const suffix = (r) => Number(r.order.orderNumber.replace(/\D/g, ''));
check(
  `ADR-014: los rechazos no queman numero (${ok.order.orderNumber} -> ${reactivated.order.orderNumber})`,
  suffix(reactivated) === suffix(ok) + 1
);

// Tanda 21 (PENDIENTES 19): un sku que no existe en el catalogo se
// rechaza con reason propio — antes pasaba en silencio y el pedido se
// persistia con una linea huerfana.
const unknownSkuInput = orderInput(target);
unknownSkuInput.items = [...unknownSkuInput.items, { sku: 'SKU-NO-EXISTE', name: 'Fantasma', quantity: 1, unitPrice: 10, subtotal: 10 }];
const ordersBefore = await createOrder(EMPRESA, orderInput(target));
const withUnknownSku = await createOrder(EMPRESA, unknownSkuInput);
check(
  'sku inexistente: reason product-not-found con el sku en detail',
  withUnknownSku.success === false && withUnknownSku.reason === 'product-not-found' && (withUnknownSku.detail ?? '').includes('SKU-NO-EXISTE')
);
const ordersAfter = await createOrder(EMPRESA, orderInput(target));
check(
  `sku inexistente: no llego al alta (no consumio numero) (${ordersBefore.order.orderNumber} -> ${ordersAfter.order.orderNumber})`,
  suffix(ordersAfter) === suffix(ordersBefore) + 1
);

// Camino de Tanda 14 migrado de `throw ApiError` a reason (ADR-015
// punto 2): baja logica real del producto, despues alta de pedido.
const { deleteProduct } = await import('../../src/shared/api/products/products.service.ts');
await deleteProduct(EMPRESA, product.id);
const withInactiveProduct = await createOrder(EMPRESA, orderInput(target));
check(
  `producto dado de baja ${product.sku}: reason inactive-product con el sku en detail`,
  withInactiveProduct.success === false && withInactiveProduct.reason === 'inactive-product' && (withInactiveProduct.detail ?? '').includes(product.sku)
);

// Precedencia (Tanda 21): con un sku inexistente Y uno dado de baja en
// el mismo pedido, gana product-not-found.
const both = await createOrder(EMPRESA, { ...unknownSkuInput, items: [...orderInput(target).items, ...unknownSkuInput.items.slice(-1)] });
check('sku inexistente + producto dado de baja: gana product-not-found', both.success === false && both.reason === 'product-not-found');

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('Todas las verificaciones pasaron.');
process.exit(0);
