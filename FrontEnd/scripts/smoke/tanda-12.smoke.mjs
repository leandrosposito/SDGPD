// ============================================================
// Smoke script — Tanda 12 (ajustes: cancelOrder server-side,
// deleteProduct baja logica, CreateClientModal persiste 2 campos, CUIT
// unico, boton Editar proveedores, isExpiringSoon corregido). Ejercita
// la funcion PURA agregada en esta tanda (sin httpClient, que lee
// import.meta.env y no corre con `node` puro): isExpired/isExpiringSoon
// (shared/utils/lotExpiration.ts).
//
// El resto de las tareas de esta tanda no tienen logica pura nueva que
// valga la pena extraer (cancelOrder/deleteProduct/CUIT son un `if`
// server-side sobre datos ya en memoria del mock — cubiertos por
// tsc/build/lint + lectura de codigo + el checklist de navegador de
// VERIFICACION_TANDA_12.md) o son wiring de UI (boton Editar).
//
// La integridad de los mocks tocados (D2 del protocolo — backfill de
// priceList/saleCondition en los 30 clientes, CUITs unicos en el seed
// de proveedores) esta en scripts/verificacion/v14-tanda12-integrity.mjs.
//
// Correr con: node scripts/smoke/tanda-12.smoke.mjs (desde FrontEnd/).
// ============================================================

import { isExpired, isExpiringSoon } from '../../src/shared/utils/lotExpiration.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.error(`FAIL ${description}`);
    failures += 1;
  }
}

// "Hoy" fijo (no Date real) — mismo criterio que el resto de los
// smoke scripts del proyecto: determinismo, sin depender del reloj de
// quien lo corre.
const NOW = new Date('2026-09-10T12:00:00Z');

function daysFromNow(days) {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ------------------------------------------------------------
// 1. isExpired — pasado estricto, sin ambiguedad en el limite.
// ------------------------------------------------------------
check('isExpired: fecha en el pasado -> true', isExpired(daysFromNow(-1), NOW) === true);
check('isExpired: fecha en el futuro -> false', isExpired(daysFromNow(5), NOW) === false);
check('isExpired: vencido hace mucho (400 dias) -> true', isExpired(daysFromNow(-400), NOW) === true);

// ------------------------------------------------------------
// 2. isExpiringSoon — el hallazgo de esta tanda: SIN Math.abs, un lote
// ya vencido nunca cuenta como "proximo a vencer" (antes, con
// Math.abs, un vencido hace 1-29 dias SI contaba — el bug quedaba
// enmascarado en ProductLotsPanel.tsx porque isExpired se chequeaba
// primero, pero la funcion en si estaba mal).
// ------------------------------------------------------------
check('isExpiringSoon: vence en 15 dias (dentro de la ventana) -> true', isExpiringSoon(daysFromNow(15), NOW) === true);
check('isExpiringSoon: vence en 30 dias (borde exacto de la ventana) -> true', isExpiringSoon(daysFromNow(30), NOW) === true);
check('isExpiringSoon: vence en 31 dias (fuera de la ventana) -> false', isExpiringSoon(daysFromNow(31), NOW) === false);
check('isExpiringSoon: vence hoy mismo (0 dias) -> true', isExpiringSoon(daysFromNow(0), NOW) === true);
check(
  'HALLAZGO CORREGIDO: vencio hace 10 dias (pasado, dentro de los 30 en valor absoluto) -> false, NO true',
  isExpiringSoon(daysFromNow(-10), NOW) === false
);
check('isExpiringSoon: vencio hace 400 dias (pasado lejano) -> false', isExpiringSoon(daysFromNow(-400), NOW) === false);

// "Vencidos aparte" (ADR implicito del fix): para CUALQUIER fecha, un
// lote nunca es simultaneamente isExpired Y isExpiringSoon — son
// mutuamente excluyentes ahora, a diferencia de con Math.abs (donde un
// lote vencido hace 10 dias daba true en las dos).
const muestras = [-400, -31, -10, -1, 0, 1, 15, 30, 31, 400];
check(
  'isExpired e isExpiringSoon son mutuamente excluyentes para cualquier fecha de muestra',
  muestras.every((d) => !(isExpired(daysFromNow(d), NOW) && isExpiringSoon(daysFromNow(d), NOW)))
);

// ------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
