// ============================================================
// Smoke script — Tanda 11 (ajustes: reprogramar libera Parada,
// numero de pedido correlativo, patente unica, override de capacidad,
// catalogos reprogramacion/no-entrega — ADR-013/ADR-014). Ejercita las
// funciones PURAS agregadas/extraidas en esta tanda (sin httpClient,
// que lee import.meta.env y no corre con `node` puro):
// normalizePatente (shared/utils/patente.ts) y
// extractOrderNumberSuffix/maxOrderNumberSuffix/formatOrderNumber
// (shared/utils/orderNumber.ts).
//
// La integridad referencial de los mocks (D2 del protocolo — catalogo
// de motivos, patentes del seed, numeros de pedido del seed) esta en
// scripts/verificacion/v13-tanda11-integrity.mjs, no aca — ese script
// SI importa los mocks reales via `@/` (imports de VALOR, no de tipo)
// y necesita el loader inline que resuelve ese alias para Node.
//
// Correr con: node scripts/smoke/tanda-11.smoke.mjs (desde FrontEnd/).
// ============================================================

import { normalizePatente } from '../../src/shared/utils/patente.ts';
import { extractOrderNumberSuffix, maxOrderNumberSuffix, formatOrderNumber } from '../../src/shared/utils/orderNumber.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.error(`FAIL ${description}`);
    failures += 1;
  }
}

// ------------------------------------------------------------
// 1. normalizePatente (Tanda 11) — mayusculas + sin espacios, aplicada
// tanto a lo guardado como a lo comparado (createVehicle/updateVehicle).
// ------------------------------------------------------------
check('normalizePatente pasa a mayusculas', normalizePatente('ab123cd') === 'AB123CD');
check('normalizePatente saca espacios internos', normalizePatente('AB 123 CD') === 'AB123CD');
check('normalizePatente saca espacios al borde', normalizePatente('  AB123CD  ') === 'AB123CD');
check('normalizePatente es idempotente (normalizar dos veces da lo mismo)', normalizePatente(normalizePatente('ab 123 cd')) === normalizePatente('ab 123 cd'));
check(
  'dos escrituras distintas de la misma patente normalizan igual (la comparacion de unicidad las trata como duplicado)',
  normalizePatente('ab123cd') === normalizePatente('AB 123 CD')
);

// ------------------------------------------------------------
// 2. orderNumber (Tanda 11, ADR-014) — formato PED-XXXXXX (6 digitos),
// correlativo (nunca reinventa desde Date.now()).
// ------------------------------------------------------------
check('extractOrderNumberSuffix parsea PED-000391 -> 391', extractOrderNumberSuffix('PED-000391') === 391);
check('extractOrderNumberSuffix parsea el formato viejo de 5 digitos PED-00391 -> 391', extractOrderNumberSuffix('PED-00391') === 391);
check('extractOrderNumberSuffix devuelve null para un formato invalido', extractOrderNumberSuffix('ABC-123') === null);
check('extractOrderNumberSuffix devuelve null para string vacio', extractOrderNumberSuffix('') === null);

check(
  'maxOrderNumberSuffix toma el maximo, no el ultimo del array (orden no importa)',
  maxOrderNumberSuffix(['PED-000391', 'PED-000200', 'PED-000350']) === 391
);
check('maxOrderNumberSuffix con array vacio da 0 (arranca el correlativo en 1)', maxOrderNumberSuffix([]) === 0);
check('maxOrderNumberSuffix ignora entradas con formato invalido en vez de romper', maxOrderNumberSuffix(['PED-000391', 'legacy-x']) === 391);

check('formatOrderNumber rellena con ceros a 6 digitos', formatOrderNumber(392, 6) === 'PED-000392');
check('formatOrderNumber no trunca un numero que ya tiene mas digitos que el minimo', formatOrderNumber(1234567, 6) === 'PED-1234567');

// El flujo real completo: semilla (391) -> siguiente -> formato.
const seedMax = maxOrderNumberSuffix(['PED-00391', 'PED-00390', 'PED-00389', 'PED-00388', 'PED-00387', 'PED-00386']);
check('flujo completo: semilla del mock (5 digitos historico) da 391', seedMax === 391);
check('flujo completo: el primer pedido nuevo despues del seed es PED-000392 (6 digitos)', formatOrderNumber(seedMax + 1, 6) === 'PED-000392');

// ------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
