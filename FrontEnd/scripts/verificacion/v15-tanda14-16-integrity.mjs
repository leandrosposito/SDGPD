// ============================================================
// V15 (verificacion adversarial de Tandas 14/15/16) — integridad de
// los mocks tocados. Importa los mocks reales (mismo resolve hook de
// @/ que v11/v12/v13/v14, no se reimplementan los datos).
//
// Tandas 14 (productos inactive) y 15 (idempotencia) no agregaron
// ningun campo nuevo a un mock ni ninguna relacion foranea nueva — son
// cambios de comportamiento (filtros, orden de ejecucion), no de
// forma de dato. Lo unico con integridad de mock para verificar es
// Tanda 16 (los 10 campos nuevos de ClientAccount, backfilleados en
// los 30 clientes semilla).
//
// Relaciones/invariantes verificados:
//   1. Los 30 clientes del seed tienen los 10 campos nuevos de Tanda 16
//      con el tipo correcto (ninguno quedo `undefined` pese a ser
//      obligatorios en ClientAccount).
//   2. Informativo: el seed de productos NO tiene ningun producto
//      'inactive' hoy (Tanda 14 depende de que Leandro de de baja uno
//      a mano en el navegador para poder verlo en accion — no se
//      sembro uno a proposito para no ensuciar el dataset semilla sin
//      necesidad, mismo criterio que VERIFICACION_TANDA_13.md punto 3).
//
// Correr con: node scripts/verificacion/v15-tanda14-16-integrity.mjs
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

console.log(`Clientes: ${CLIENTS_MOCK_DATA.length} | Productos: ${INVENTORY_MOCK_DATA.items.length}`);
console.log('');

// 1. Backfill de los 10 campos nuevos de Tanda 16
console.log('--- Clientes: los 10 campos nuevos de Tanda 16 backfilleados con el tipo correcto ---');
const STRING_FIELDS = ['tradeName', 'ivaCondition', 'email', 'googleMapsLink', 'deliveryAddress', 'deliveryReferences', 'businessCategory', 'notes'];
const BOOLEAN_FIELDS = ['deliveryAddressSameAsFiscal', 'isActive'];
for (const c of CLIENTS_MOCK_DATA) {
  for (const field of STRING_FIELDS) {
    check(`${c.id}: ${field} es string (no undefined)`, typeof c[field] === 'string');
  }
  for (const field of BOOLEAN_FIELDS) {
    check(`${c.id}: ${field} es boolean (no undefined)`, typeof c[field] === 'boolean');
  }
}

// 2. Informativo: estado del seed de productos para Tanda 14
console.log('');
console.log('--- Productos: informativo, para el checklist de navegador de Tanda 14 ---');
const inactivos = INVENTORY_MOCK_DATA.items.filter((p) => p.status === 'inactive');
console.log(`     ${inactivos.length} producto(s) inactivo(s) en el seed (esperado: 0 — Leandro da de baja uno a mano para probar Tanda 14).`);
check('ningun producto del seed arranca inactivo (a proposito, ver comentario de arriba)', inactivos.length === 0);
check('hay al menos un producto activo para poder desactivar y probar', INVENTORY_MOCK_DATA.items.some((p) => p.status === 'active'));

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) de integridad fallaron.`);
  process.exit(1);
} else {
  console.log('Toda la integridad verificada paso.');
  process.exit(0);
}
