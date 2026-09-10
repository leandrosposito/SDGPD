// ============================================================
// V13 (verificacion adversarial de Tanda 11, ADR-013/ADR-014) —
// integridad de los mocks tocados por esta tanda. Importa los mocks
// reales (mismo resolve hook de @/ que v11/v12, no se reimplementan
// los datos).
//
// Relaciones/invariantes verificados:
//   1. Patentes del seed de vehiculos, unicas una vez normalizadas
//      (createVehicle/updateVehicle dependen de que el seed ya cumpla
//      la regla que ellos mismos empiezan a exigir).
//   2. Catalogo de motivos: 'reprogramacion'/'no-entrega' sembrados,
//      cada uno con su 'OTRO', y disparaLogisticaInversa=false en
//      TODOS los items de esos dos tipos (ADR-013: la mercaderia nunca
//      sale del camion en ninguno de los dos casos).
//   3. numero_pedido del seed de pedidos: todos matchean el formato
//      PED-<digitos> y son unicos entre si (la base sobre la que
//      nextOrderNumber siembra su contador).
//
// Correr con: node scripts/verificacion/v13-tanda11-integrity.mjs
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

const { VEHICLES_MOCK_DATA } = await import('../../src/data/mock/vehicles.data.ts');
const { MOTIVOS_MOCK_DATA } = await import('../../src/data/mock/motivos.data.ts');
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

function normalizePatente(raw) {
  return raw.toUpperCase().replace(/\s+/g, '');
}

console.log(`Vehiculos: ${VEHICLES_MOCK_DATA.length} | Motivos: ${MOTIVOS_MOCK_DATA.length} | Pedidos: ${ORDERS_MOCK_DATA.length}`);
console.log('');

// 1. Patentes del seed, unicas normalizadas
console.log('--- Vehiculos: patentes unicas (normalizadas) ---');
const patentesVistas = new Set();
for (const v of VEHICLES_MOCK_DATA) {
  const normalizada = normalizePatente(v.patente);
  check(`${v.id}: patente "${v.patente}" (normalizada "${normalizada}") es unica en el seed`, !patentesVistas.has(normalizada));
  patentesVistas.add(normalizada);
}

// 2. Catalogo de motivos
console.log('');
console.log('--- Catalogo de motivos: reprogramacion/no-entrega sembrados ---');
for (const tipo of ['reprogramacion', 'no-entrega']) {
  const items = MOTIVOS_MOCK_DATA.filter((m) => m.tipo === tipo);
  check(`tipo '${tipo}': hay al menos 2 motivos ademas de OTRO`, items.filter((m) => m.codigo !== 'OTRO').length >= 2);
  check(`tipo '${tipo}': tiene un item OTRO`, items.some((m) => m.codigo === 'OTRO'));
  check(`tipo '${tipo}': todos los items estan activos`, items.every((m) => m.activo));
  check(
    `tipo '${tipo}': disparaLogisticaInversa es false en TODOS los items (ADR-013 — la mercaderia nunca sale del camion)`,
    items.every((m) => m.disparaLogisticaInversa === false)
  );
}

// 3. Numeros de pedido del seed
console.log('');
console.log('--- Pedidos: numero_pedido con formato valido y unico ---');
const numerosVistos = new Set();
for (const o of ORDERS_MOCK_DATA) {
  check(`${o.id}: orderNumber "${o.orderNumber}" matchea el formato PED-<digitos>`, /^PED-\d+$/.test(o.orderNumber));
  check(`${o.id}: orderNumber "${o.orderNumber}" es unico en el seed`, !numerosVistos.has(o.orderNumber));
  numerosVistos.add(o.orderNumber);
}

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) de integridad fallaron.`);
  process.exit(1);
} else {
  console.log('Toda la integridad verificada paso.');
  process.exit(0);
}
