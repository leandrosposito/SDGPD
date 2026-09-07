// ============================================================
// Smoke script — Tanda 4 (corrida completa): estado de listados en la
// URL. Ejercita la logica PURA de parseo/serializacion de pagina y
// orden que usa useUrlListState.ts (la parte del hook que sincroniza
// con useSearchParams no es pura y no se ejercita aca — eso lo
// verifica Leandro en el navegador, ver VERIFICACION_TANDA_4.md).
//
// Sin framework de testing: node ejecuta este archivo directo. Node 24
// soporta type-stripping nativo de TypeScript (los `import type` se
// eliminan en tiempo de carga, sin transformacion de codigo real), asi
// que se importan las funciones reales del hook en vez de duplicar su
// logica aca — si alguien cambia el parseo, este script deja de pasar
// en vez de quedar desincronizado en silencio.
//
// Correr con: node scripts/smoke/tanda-4.smoke.mjs (desde FrontEnd/).
// ============================================================

import {
  parsePageParam,
  serializePageParam,
  parseSortParam,
  serializeSortParam,
} from '../../src/shared/hooks/useUrlListState.ts';

let failures = 0;

function check(description, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) {
    console.log(`OK   ${description}`);
  } else {
    failures += 1;
    console.error(`FAIL ${description}: esperaba ${JSON.stringify(expected)}, obtuve ${JSON.stringify(actual)}`);
  }
}

// --- parsePageParam ---
check('parsePageParam(null) -> 1 (ausente)', parsePageParam(null), 1);
check('parsePageParam(undefined) -> 1 (ausente)', parsePageParam(undefined), 1);
check('parsePageParam("") -> 1 (string vacio)', parsePageParam(''), 1);
check('parsePageParam("3") -> 3 (valido)', parsePageParam('3'), 3);
check('parsePageParam("0") -> 1 (invalido, menor a 1)', parsePageParam('0'), 1);
check('parsePageParam("-5") -> 1 (invalido, negativo)', parsePageParam('-5'), 1);
check('parsePageParam("abc") -> 1 (invalido, no numerico)', parsePageParam('abc'), 1);
check('parsePageParam("2.5") -> 1 (invalido, no entero)', parsePageParam('2.5'), 1);

// --- serializePageParam ---
check('serializePageParam(1) -> undefined (default, se omite de la URL)', serializePageParam(1), undefined);
check('serializePageParam(5) -> "5"', serializePageParam(5), '5');

// --- parseSortParam ---
check('parseSortParam(null) -> undefined (ausente)', parseSortParam(null), undefined);
check(
  'parseSortParam("stock:asc") -> {field:"stock",direction:"asc"}',
  parseSortParam('stock:asc'),
  { field: 'stock', direction: 'asc' }
);
check(
  'parseSortParam("productName:desc") -> {field:"productName",direction:"desc"} (campo con mayusculas)',
  parseSortParam('productName:desc'),
  { field: 'productName', direction: 'desc' }
);
check('parseSortParam("stock:sideways") -> undefined (direccion invalida)', parseSortParam('stock:sideways'), undefined);
check('parseSortParam("sinseparador") -> undefined (formato invalido)', parseSortParam('sinseparador'), undefined);
check(
  'parseSortParam("stock:asc", ["name","minStock"]) -> undefined (campo fuera de la whitelist)',
  parseSortParam('stock:asc', ['name', 'minStock']),
  undefined
);
check(
  'parseSortParam("name:asc", ["name","minStock"]) -> {field:"name",direction:"asc"} (campo permitido)',
  parseSortParam('name:asc', ['name', 'minStock']),
  { field: 'name', direction: 'asc' }
);

// --- serializeSortParam ---
check('serializeSortParam(undefined) -> undefined', serializeSortParam(undefined), undefined);
check(
  'serializeSortParam({field:"stock",direction:"desc"}) -> "stock:desc"',
  serializeSortParam({ field: 'stock', direction: 'desc' }),
  'stock:desc'
);

// --- ida y vuelta (round-trip) ---
const roundTripSort = { field: 'minStock', direction: 'asc' };
check(
  'round-trip: parseSortParam(serializeSortParam(x)) === x',
  parseSortParam(serializeSortParam(roundTripSort)),
  roundTripSort
);

// --- caso guia: pagina 1 nunca ensucia la URL, pero se relee bien ---
check(
  'round-trip pagina: parsePageParam(serializePageParam(1)) -> 1 (via ausencia)',
  parsePageParam(serializePageParam(1)),
  1
);
check('round-trip pagina: parsePageParam(serializePageParam(7)) -> 7', parsePageParam(serializePageParam(7)), 7);

console.log('');
if (failures > 0) {
  console.error(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('Todas las verificaciones pasaron.');
process.exit(0);
