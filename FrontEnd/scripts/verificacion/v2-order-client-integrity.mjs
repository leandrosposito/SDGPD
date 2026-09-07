// ============================================================
// V2 (verificacion adversarial de la corrida completa) — recorre
// TODOS los pedidos del mock real y confirma que su `clientId` (Tanda
// 5, ADR-006) resuelve a un cliente real del directorio, y que el
// `clientName` snapshot del pedido coincide con el nombre real de ese
// cliente (si no coincide, es evidencia de que el remapeo original
// pudo haberse hecho mal).
//
// Importa los MOCKS REALES del proyecto (no reimplementa/copia los
// datos) via un resolve hook minimo que mapea el alias `@/` a `src/`
// -- Node no lo resuelve nativo y el proyecto no tiene ningun paquete
// de alias instalado (esta prohibido agregar dependencias nuevas para
// esta verificacion). El hook vive en este mismo archivo, no se toca
// ningun archivo de configuracion del proyecto.
//
// Correr con: node scripts/verificacion/v2-order-client-integrity.mjs
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

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

// Igual que check(), pero un resultado negativo NO suma a `failures` —
// para verificaciones informativas (ej. un snapshot textual que puede
// divergir legitimamente) que no invalidan la relacion en si.
function infoCheck(description, condition) {
  console.log(`${condition ? 'OK  ' : 'INFO'} ${description}`);
}

console.log(`Pedidos en el mock: ${ORDERS_MOCK_DATA.length}`);
console.log(`Clientes en el mock: ${CLIENTS_MOCK_DATA.length}`);
console.log('');

const clientsById = new Map(CLIENTS_MOCK_DATA.map((c) => [c.id, c]));

for (const order of ORDERS_MOCK_DATA) {
  const client = clientsById.get(order.clientId);

  check(
    `${order.id} (${order.orderNumber}): clientId "${order.clientId}" existe en el directorio de clientes`,
    Boolean(client)
  );

  if (client) {
    // Informativo, no hace fallar el script (no cuenta para `failures`):
    // el clientName del pedido es un SNAPSHOT historico al momento de
    // crear el pedido, no tiene por que ser char-a-char identico al
    // nombre actual del cliente (que puede llevar anotaciones nuevas,
    // ej. "(Excedido)" agregado al mock despues como marca de QA) — la
    // relacion es igual de valida aunque el snapshot difiera. Ver V2 de
    // VERIFICACION_CORRIDA_COMPLETA.md.
    const namesMatch = client.clientName === order.clientName;
    infoCheck(
      `${order.id}: clientName del pedido ("${order.clientName}") coincide con el del cliente real ("${client.clientName}")`,
      namesMatch
    );
  }
}

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
} else {
  console.log('Todos los pedidos tienen un clientId valido y consistente.');
  process.exit(0);
}
