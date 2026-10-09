// ============================================================
// V18 (BE-1b, Parte 2 punto 2) — ids compartidos entre el mock y el seed.
// El mock de sesion usa, para la empresa demo y sus 4 sucursales, los
// MISMOS UUID fijos que el seed de desarrollo del backend
// (BackEnd/scripts/db/demo-ids.ts). Asi un modulo que va por http y otro
// que sigue en mock hablan de las mismas sucursales. Este script importa
// los dos lados reales (no copias) y los compara:
//   1. el id de la empresa del mock es DEMO_EMPRESA_ID;
//   2. las sucursales del mock son exactamente las DEMO_BRANCHES (id,
//      nombre, codigo, ciudad, direccion y estado), en el mismo orden;
//   3. ningun archivo de src/data/mock/ conserva un id legado de la
//      empresa o de esas sucursales ('company-001', 'branch-00N') como
//      dato (entre comillas; los comentarios no cuentan).
// Correr con: node scripts/verificacion/v18-ids-demo.mjs (desde FrontEnd/).
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
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

const { SESSION_MOCK_DATA } = await import('../../src/data/mock/session.mock.ts');
const { DEMO_EMPRESA_ID, DEMO_BRANCHES } = await import('../../../BackEnd/scripts/db/demo-ids.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

check(`la empresa del mock es la empresa demo del seed (${DEMO_EMPRESA_ID})`, SESSION_MOCK_DATA.company.id === DEMO_EMPRESA_ID);

const pick = (b) => ({ id: b.id, name: b.name, code: b.code, city: b.city, address: b.address, status: b.status });
const mockBranches = SESSION_MOCK_DATA.branches.map(pick);
const seedBranches = DEMO_BRANCHES.map(pick);
check(`el mock tiene las ${seedBranches.length} sucursales del seed`, mockBranches.length === seedBranches.length);
seedBranches.forEach((seed, i) => {
  check(
    `sucursal ${seed.code}: mismo id (${seed.id}), nombre, ciudad, direccion y estado en el mock`,
    JSON.stringify(mockBranches[i]) === JSON.stringify(seed)
  );
});

const mockDir = new URL('../../src/data/mock/', import.meta.url);
const legacy = /(['"`])(company-001|branch-00[1-4])\1/g;
const leftovers = [];
for (const file of readdirSync(mockDir).filter((f) => f.endsWith('.ts'))) {
  const code = readFileSync(new URL(file, mockDir), 'utf8').replace(/\/\/[^\n]*/g, '');
  for (const match of code.matchAll(legacy)) leftovers.push(`${file}: ${match[0]}`);
}
check(`ningun mock conserva un id legado de la empresa demo o de sus sucursales como dato (${leftovers.length})`, leftovers.length === 0);
for (const l of leftovers) console.log(`     ${l}`);

console.log(failures === 0 ? '\nTodas las verificaciones pasaron.' : `\n${failures} verificacion(es) fallaron.`);
process.exitCode = failures === 0 ? 0 : 1;
