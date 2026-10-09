// ============================================================
// Smoke script — Tanda 24: rango de fechas en la URL (regla PROTOCOLO
// 3.8, enmienda 2026-10-09). Ejercita la logica PURA de lectura
// (readDateRangeFromUrl) y escritura (dateRangeToUrlParams) que
// comparten los 5 listados con DateRangeFilter, con "hoy" inyectado —
// importa el codigo real de dateRangePresets.ts, no una copia.
//
// Correr con: node scripts/smoke/tanda-24.smoke.mjs (desde FrontEnd/).
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

const { readDateRangeFromUrl, dateRangeToUrlParams } = await import('../../src/shared/components/ui/dateRangePresets.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

// Fechas locales (new Date(y, m, d)): computeDateRangeForPreset formatea
// en hora local, igual que el navegador.
const TODAY = new Date(2026, 9, 9); // 2026-10-09
const same = (v, preset, from, to) => v.preset === preset && v.dateFrom === from && v.dateTo === to;
const show = (v) => `${v.preset} ${v.dateFrom ?? '-'}..${v.dateTo ?? '-'}`;
const read = (params, def, today = TODAY) => readDateRangeFromUrl(params, def, today);

// ------------------------------------------------------------
// 1. Los 5 casos de la auditoria 24.1.b, para los dos defaults reales
//    (Logistica 'today', los otros 4 'all').
// ------------------------------------------------------------
const SEPT = { from: '2026-09-01', to: '2026-09-30' };
const CUSTOM = { from: '2026-09-05', to: '2026-09-20' };
for (const def of ['all', 'today']) {
  const expectedDefault = def === 'all' ? ['all', undefined, undefined] : ['today', '2026-10-09', '2026-10-09'];
  let v = read({}, def);
  check(`[default ${def}] 1. sin parametros -> ${expectedDefault.join(' ')} (obtuvo ${show(v)})`, same(v, ...expectedDefault));
  v = read({ preset: 'thisMonth' }, def);
  check(`[default ${def}] 2. ?preset=thisMonth -> mes actual 2026-10-01..2026-10-09 (obtuvo ${show(v)})`, same(v, 'thisMonth', '2026-10-01', '2026-10-09'));
  v = read({ preset: 'thisMonth', ...SEPT }, def);
  check(`[default ${def}] 3. link viejo ?preset=thisMonth&from/to de septiembre -> filtra por el mes ACTUAL (obtuvo ${show(v)})`, same(v, 'thisMonth', '2026-10-01', '2026-10-09'));
  v = read({ preset: 'custom', ...CUSTOM }, def);
  check(`[default ${def}] 4. ?preset=custom&from&to -> esas fechas (obtuvo ${show(v)})`, same(v, 'custom', CUSTOM.from, CUSTOM.to));
  v = read({ ...CUSTOM }, def);
  check(`[default ${def}] 5. ?from&to sin preset -> se interpreta custom (obtuvo ${show(v)})`, same(v, 'custom', CUSTOM.from, CUSTOM.to));
}

// ------------------------------------------------------------
// 2. Bordes de lectura.
// ------------------------------------------------------------
check('?preset=all&from&to -> los from/to se ignoran (van solo con custom)', same(read({ preset: 'all', ...SEPT }, 'today'), 'all', undefined, undefined));
check('?preset=basura -> default del listado', same(read({ preset: 'basura' }, 'all'), 'all', undefined, undefined));
check('?preset=basura&from&to -> custom (from/to sin preset valido)', same(read({ preset: 'basura', ...CUSTOM }, 'all'), 'custom', CUSTOM.from, CUSTOM.to));
check('?preset=custom sin fechas -> custom vacio (todavia sin completar)', same(read({ preset: 'custom' }, 'all'), 'custom', undefined, undefined));

// ------------------------------------------------------------
// 3. Escritura: preset solo si no es el default; from/to solo con custom.
// ------------------------------------------------------------
const w = (value, def) => dateRangeToUrlParams(value, def);
const isPatch = (p, preset, from, to) => p.preset === preset && p.from === from && p.to === to;
// DateRangeFilter emite el rango calculado junto con un preset fijo:
// la escritura tiene que descartarlo.
check('elegir "Este mes" (filtro emite from/to calculados) -> solo preset=thisMonth, sin from/to', isPatch(w({ preset: 'thisMonth', dateFrom: '2026-10-01', dateTo: '2026-10-09' }, 'all'), 'thisMonth', undefined, undefined));
check('cambio de custom a fijo limpia from/to (patch los borra)', isPatch(w({ preset: 'last7days', dateFrom: CUSTOM.from, dateTo: CUSTOM.to }, 'all'), 'last7days', undefined, undefined));
check('custom escribe preset=custom + from/to', isPatch(w({ preset: 'custom', dateFrom: CUSTOM.from, dateTo: CUSTOM.to }, 'all'), 'custom', CUSTOM.from, CUSTOM.to));
check('el default del listado no se escribe ("Todos" en un listado con default all)', isPatch(w({ preset: 'all' }, 'all'), undefined, undefined, undefined));
check('el default del listado no se escribe ("Hoy" en Logistica)', isPatch(w({ preset: 'today', dateFrom: '2026-10-09', dateTo: '2026-10-09' }, 'today'), undefined, undefined, undefined));
check('"Todos" en Logistica (default today) SI se escribe', isPatch(w({ preset: 'all' }, 'today'), 'all', undefined, undefined));

// Ida y vuelta: leer lo escrito devuelve el mismo rango.
for (const [def, value] of [
  ['all', { preset: 'custom', dateFrom: CUSTOM.from, dateTo: CUSTOM.to }],
  ['all', { preset: 'thisQuarter', dateFrom: 'x', dateTo: 'y' }],
  ['today', { preset: 'today' }],
]) {
  const back = read(w(value, def), def);
  const expected = value.preset === 'custom' ? value : read({ preset: value.preset }, def);
  check(`ida y vuelta [default ${def}] ${value.preset} -> ${show(back)}`, same(back, expected.preset, expected.dateFrom, expected.dateTo));
}

// ------------------------------------------------------------
// 4. Cruce de mes, de trimestre y de anio (hoy inyectado).
// ------------------------------------------------------------
check('cruce de mes: last7days el 2026-03-03 -> 2026-02-25..2026-03-03', same(read({ preset: 'last7days' }, 'all', new Date(2026, 2, 3)), 'last7days', '2026-02-25', '2026-03-03'));
check('cruce de mes: thisMonth el 2026-03-01 -> 2026-03-01..2026-03-01', same(read({ preset: 'thisMonth' }, 'all', new Date(2026, 2, 1)), 'thisMonth', '2026-03-01', '2026-03-01'));
check('cruce de trimestre: thisQuarter el 2026-04-01 -> 2026-04-01..2026-04-01', same(read({ preset: 'thisQuarter' }, 'all', new Date(2026, 3, 1)), 'thisQuarter', '2026-04-01', '2026-04-01'));
check('fin de trimestre: thisQuarter el 2026-03-31 -> 2026-01-01..2026-03-31', same(read({ preset: 'thisQuarter' }, 'all', new Date(2026, 2, 31)), 'thisQuarter', '2026-01-01', '2026-03-31'));
check('cruce de anio: last7days el 2026-01-03 -> 2025-12-28..2026-01-03', same(read({ preset: 'last7days' }, 'all', new Date(2026, 0, 3)), 'last7days', '2025-12-28', '2026-01-03'));
check('trimestre en curso: thisQuarter el 2026-10-09 -> 2026-10-01..2026-10-09', same(read({ preset: 'thisQuarter' }, 'all'), 'thisQuarter', '2026-10-01', '2026-10-09'));

// ------------------------------------------------------------
if (failures > 0) {
  console.log(`\n${failures} verificacion(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
process.exit(0);
