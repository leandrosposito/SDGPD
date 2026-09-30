// ============================================================
// Smoke script — Tanda 15 (hallazgo MEDIO: precondiciones antes de
// withIdempotency en markStopNoVisitada/reprogramDelivery/
// registrarEntrega/createDelivery). Ejercita el contrato PURO de
// withIdempotency (shared/utils/idempotency.ts, sin httpClient) contra
// los dos patrones en juego, para dejar a la vista por que uno respeta
// ADR-010 seccion 4 y el otro no.
//
// El fix en si (mover el cuerpo de las 4 funciones adentro del
// callback de withIdempotency) es wiring de service ya cubierto por
// tsc/build/lint + lectura de codigo + el checklist de navegador de
// VERIFICACION_TANDA_15.md — lo que vale la pena smoke-testear aislado
// es el contrato general que ese wiring tiene que respetar.
//
// Correr con: node scripts/smoke/tanda-15.smoke.mjs (desde FrontEnd/).
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

const { withIdempotency } = await import('../../src/shared/utils/idempotency.ts');

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

// --- Simula el caso markStopNoVisitada: una "Parada" con estado
// mutable, y un compute que valida una precondicion sobre ese estado
// antes de mutarlo. ---

console.log('--- Patron CORRECTO: precondicion ADENTRO de withIdempotency ---');
{
  let stopEstado = 'Pendiente';
  const key = 'key-correcto';

  async function markNoVisitadaCorrecto() {
    return withIdempotency(key, async () => {
      // Precondicion evaluada DENTRO del callback: si la clave ya esta
      // cacheada, withIdempotency ni siquiera llega a llamar esto.
      if (stopEstado !== 'Pendiente') {
        return { success: false, reason: 'stop-not-pendiente' };
      }
      stopEstado = 'NoVisitada';
      return { success: true, reason: undefined };
    });
  }

  const first = await markNoVisitadaCorrecto();
  check('primer llamado tiene exito', first.success === true);
  check('la Parada quedo NoVisitada tras el primer llamado', stopEstado === 'NoVisitada');

  // Reintento con la MISMA clave (httpClient reintenta POST con
  // DEFAULT_RETRIES=2, o el usuario reintenta a mano) DESPUES de que
  // el estado ya mutó.
  const retry = await markNoVisitadaCorrecto();
  check('el reintento devuelve el MISMO resultado exitoso (no una precondicion re-evaluada)', retry.success === true);
  check('el reintento es idéntico al original (ADR-010 seccion 4: nunca un error)', JSON.stringify(retry) === JSON.stringify(first));
}

console.log('');
console.log('--- Patron INCORRECTO (el bug de Tanda 13/hallazgo MEDIO): precondicion AFUERA ---');
{
  let stopEstado = 'Pendiente';
  const key = 'key-incorrecto';

  async function markNoVisitadaIncorrecto() {
    // Precondicion evaluada AFUERA, antes de siquiera preguntarle a
    // withIdempotency si la clave ya fue procesada — exactamente el
    // patron que tenia markStopNoVisitada/reprogramDelivery/
    // registrarEntrega/createDelivery antes de esta tanda.
    if (stopEstado !== 'Pendiente') {
      return { success: false, reason: 'stop-not-pendiente' };
    }
    return withIdempotency(key, async () => {
      stopEstado = 'NoVisitada';
      return { success: true, reason: undefined };
    });
  }

  const first = await markNoVisitadaIncorrecto();
  check('primer llamado tiene exito', first.success === true);

  const retry = await markNoVisitadaIncorrecto();
  // Este check documenta el BUG que Tanda 15 corrigio: con la
  // precondicion afuera, el reintento NO devuelve el resultado
  // cacheado — devuelve un fallo nuevo, porque la precondicion ve el
  // estado ya mutado antes de que withIdempotency tenga chance de
  // responder desde el cache. Si este check alguna vez empieza a
  // pasar, `withIdempotency` cambio de contrato (o dejo de existir el
  // problema que este script documenta) — revisar antes de "arreglar"
  // el script.
  check(
    'demuestra el bug: con la precondicion afuera, el reintento pisa el exito original con un fallo',
    retry.success === false && retry.reason === 'stop-not-pendiente'
  );
}

console.log('');
if (failures > 0) {
  console.log(`${failures} verificacion(es) fallaron.`);
  process.exit(1);
} else {
  console.log('Todas las verificaciones pasaron.');
  process.exit(0);
}
