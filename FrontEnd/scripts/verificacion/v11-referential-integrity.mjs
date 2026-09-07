// ============================================================
// V11 (verificacion adversarial de la corrida completa) — integridad
// referencial de TODOS los mocks reales del proyecto. Importa los
// mocks reales (mismo resolve hook de @/ que v2-order-client-integrity.mjs,
// no se reimplementan los datos).
//
// Relaciones verificadas:
//   1. Lineas de pedido -> pedido contenedor (unicidad de OrderLineId).
//   2. Pedido -> cliente (Order.clientId existe en el directorio).
//   3. Entregas -> sucursales (Delivery.branchId existe en session.branches).
//   4. Entregas -> pedidos (Delivery.orderId existe en ORDERS_MOCK_DATA).
//   5. Alertas -> entidades referenciadas (deliveryId/productId/branchId
//      segun el tipo de alerta).
//   6. Movimientos de inventario -> productos (InventoryMovement.sku
//      existe en INVENTORY_MOCK_DATA.items) y -> sucursales (branchId).
//   7. Remitos -> lineas de pedido: NO HAY DATOS ESTATICOS que revisar
//      (deliveryNotesStore arranca vacio en deliveries.service.ts, se
//      puebla solo en runtime via registrarEntrega) — se deja
//      explicito en la salida en vez de omitirlo en silencio.
//
// Correr con: node scripts/verificacion/v11-referential-integrity.mjs
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
const { CLIENTS_MOCK_DATA } = await import('../../src/data/mock/clients.data.ts');
const { LOGISTICS_MOCK_DATA } = await import('../../src/data/mock/logistics.data.ts');
const { SESSION_MOCK_DATA } = await import('../../src/data/mock/session.mock.ts');
const { ALERTS_MOCK_DATA } = await import('../../src/data/mock/alerts.data.ts');
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

const branchIds = new Set(SESSION_MOCK_DATA.branches.map((b) => b.id));
const clientIds = new Set(CLIENTS_MOCK_DATA.map((c) => c.id));
const orderIds = new Set(ORDERS_MOCK_DATA.map((o) => o.id));
const deliveryIds = new Set(LOGISTICS_MOCK_DATA.map((d) => d.id));
const productSkus = new Set(INVENTORY_MOCK_DATA.items.map((p) => p.sku));
const productIds = new Set(INVENTORY_MOCK_DATA.items.map((p) => p.id));

console.log(`Sucursales: ${branchIds.size} | Clientes: ${clientIds.size} | Pedidos: ${orderIds.size} | Entregas: ${deliveryIds.size} | Productos: ${productIds.size}`);
console.log('');

// 1+2. Lineas de pedido (unicidad) + Order -> Cliente
console.log('--- Pedidos: lineas y relacion a cliente ---');
const seenLineIds = new Set();
for (const order of ORDERS_MOCK_DATA) {
  check(`${order.id}: clientId "${order.clientId}" existe en clientes`, clientIds.has(order.clientId));
  for (const item of order.items) {
    check(`${order.id}/${item.id}: OrderLineId unico en todo el mock`, !seenLineIds.has(item.id));
    seenLineIds.add(item.id);
  }
}

// 3+4. Entregas -> sucursales y -> pedidos
console.log('');
console.log('--- Entregas: relacion a sucursal y a pedido ---');
for (const delivery of LOGISTICS_MOCK_DATA) {
  check(`${delivery.id}: branchId "${delivery.branchId}" existe en sucursales`, branchIds.has(delivery.branchId));
  check(`${delivery.id}: orderId "${delivery.orderId}" existe en pedidos`, orderIds.has(delivery.orderId));
}

// 5. Alertas -> entidades referenciadas
console.log('');
console.log('--- Alertas: relacion a entidad referenciada ---');
for (const alert of ALERTS_MOCK_DATA) {
  if (alert.tipo === 'transferencia-retrasada') {
    check(`${alert.id} (transferencia-retrasada): deliveryId "${alert.deliveryId}" existe en entregas`, deliveryIds.has(alert.deliveryId));
  } else if (alert.tipo === 'producto-por-vencer') {
    check(`${alert.id} (producto-por-vencer): productId "${alert.productId}" existe en productos`, productIds.has(alert.productId));
    check(`${alert.id} (producto-por-vencer): branchId "${alert.branchId}" existe en sucursales`, branchIds.has(alert.branchId));
  }
}

// 6. Movimientos -> productos y sucursales
console.log('');
console.log('--- Movimientos de inventario: relacion a producto (sku) y sucursal ---');
for (const mov of INVENTORY_MOCK_DATA.movements) {
  check(`${mov.id}: sku "${mov.sku}" existe en el catalogo de productos`, productSkus.has(mov.sku));
  check(`${mov.id}: branchId "${mov.branchId}" existe en sucursales`, branchIds.has(mov.branchId));
}

// 7. Remitos -> lineas de pedido: nada que revisar estaticamente
console.log('');
console.log('--- Remitos -> lineas de pedido ---');
console.log('INFO deliveryNotesStore arranca vacio (deliveries.service.ts) — no hay remitos seed en ningun mock estatico, nada que verificar aca. Se crean solo en runtime via registrarEntrega().');

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) de integridad referencial fallaron.`);
  process.exit(1);
} else {
  console.log('Toda la integridad referencial verificada paso.');
  process.exit(0);
}
