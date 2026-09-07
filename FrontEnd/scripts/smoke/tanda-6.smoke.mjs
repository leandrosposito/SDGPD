// ============================================================
// Smoke script — Tanda 6 (corrida completa): exportacion server-side
// asincrona (ADR-004). Ejercita la MAQUINA DE ESTADOS del job
// (exportJobs.ts) sin DOM real: ese modulo no importa xlsx ni usa
// Blob/URL — quien arma el archivo real (buildExportFile.ts) se
// inyecta como parametro (`buildFile`), asi que ese caso se testea aca
// con un `buildFile` falso, sin necesitar `xlsx` ni un navegador.
//
// Cubre:
//   1. exportJobStepAt (pura): secuencia de pasos intermedios correcta.
//   2. createExportJob + getExportJobStatus con filas reales -> termina
//      en 'listo' con downloadUrl/fileName del buildFile inyectado.
//   3. createExportJob con fetchRows que devuelve 0 filas -> termina en
//      'vacio', sin llamar a buildFile.
//   4. createExportJob con fetchRows que rechaza -> termina en 'error'
//      con errorMessage.
//   5. getExportJobStatus de un jobId inexistente -> 'error' explicito
//      (nunca undefined/silencioso).
//
// Usa stepDelayMs bajo para no hacer esperar de mas al script (el
// default de produccion, DEFAULT_STEP_DELAY_MS=500ms, no se prueba
// directamente aca porque exportJobStepAt ya cubre la secuencia sin
// tiempo real).
//
// Correr con: node scripts/smoke/tanda-6.smoke.mjs (desde FrontEnd/).
// ============================================================

import { exportJobStepAt, createExportJob, getExportJobStatus } from '../../src/shared/api/exports/exportJobs.ts';

let failures = 0;

function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- 1. exportJobStepAt es pura y tiene la secuencia esperada ---

const step0 = exportJobStepAt(0);
check(
  'exportJobStepAt(0) -> pendiente/0, no final',
  step0.status === 'pendiente' && step0.progreso === 0 && step0.isFinal === false
);

const step1 = exportJobStepAt(1);
check('exportJobStepAt(1) -> procesando/30, no final', step1.status === 'procesando' && step1.progreso === 30 && !step1.isFinal);

const step3 = exportJobStepAt(3);
check('exportJobStepAt(3) -> procesando/90, no final', step3.status === 'procesando' && step3.progreso === 90 && !step3.isFinal);

const step4 = exportJobStepAt(4);
check('exportJobStepAt(4) -> paso final (isFinal true)', step4.isFinal === true);

const step99 = exportJobStepAt(99);
check('exportJobStepAt(99) (fuera de rango) -> tambien final', step99.isFinal === true);

// Fake buildFile: no depende de xlsx/Blob/URL, solo devuelve un
// resultado predecible para verificar que createExportJob lo invoca
// con los argumentos correctos.
let buildFileCalls = 0;
function fakeBuildFile(items, columns, formato, fileNamePrefix) {
  buildFileCalls++;
  return { downloadUrl: `blob:fake-${fileNamePrefix}`, fileName: `${fileNamePrefix}.${formato}` };
}

const FAST_STEP_DELAY_MS = 10;

async function waitForFinalState(jobId, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const state = await getExportJobStatus(jobId);
    if (state.status === 'listo' || state.status === 'vacio' || state.status === 'error') {
      return state;
    }
    await sleep(FAST_STEP_DELAY_MS);
  }
  throw new Error(`El job ${jobId} no llego a un estado final tras ${maxAttempts} intentos.`);
}

// --- 2. Job con filas reales -> 'listo' con downloadUrl/fileName ---

async function testJobWithRows() {
  const items = [{ id: 'a' }, { id: 'b' }];
  const columns = [{ header: 'ID', accessor: (row) => row.id }];

  const { jobId } = await createExportJob({
    fileNamePrefix: 'test-con-filas',
    formato: 'csv',
    columns,
    fetchRows: async () => ({ items, truncated: false }),
    buildFile: fakeBuildFile,
    stepDelayMs: FAST_STEP_DELAY_MS,
  });

  const initial = await getExportJobStatus(jobId);
  check('job nuevo arranca en pendiente', initial.status === 'pendiente');

  const final = await waitForFinalState(jobId);
  check('job con filas termina en listo', final.status === 'listo');
  check('job listo tiene downloadUrl y fileName del buildFile inyectado', final.downloadUrl === 'blob:fake-test-con-filas' && final.fileName === 'test-con-filas.csv');
  check('job listo reporta totalFilas correcto', final.totalFilas === 2);
  check('job listo reporta truncado=false', final.truncado === false);
}

// --- 3. Job sin filas -> 'vacio', sin llamar a buildFile ---

async function testJobEmpty() {
  const callsBefore = buildFileCalls;
  const { jobId } = await createExportJob({
    fileNamePrefix: 'test-vacio',
    formato: 'xlsx',
    columns: [],
    fetchRows: async () => ({ items: [], truncated: false }),
    buildFile: fakeBuildFile,
    stepDelayMs: FAST_STEP_DELAY_MS,
  });

  const final = await waitForFinalState(jobId);
  check('job sin filas termina en vacio', final.status === 'vacio');
  check('job vacio NO llama a buildFile', buildFileCalls === callsBefore);
}

// --- 4. Job cuyo fetchRows falla -> 'error' con mensaje ---

async function testJobError() {
  const { jobId } = await createExportJob({
    fileNamePrefix: 'test-error',
    formato: 'csv',
    columns: [],
    fetchRows: async () => {
      throw new Error('fallo simulado de red');
    },
    buildFile: fakeBuildFile,
    stepDelayMs: FAST_STEP_DELAY_MS,
  });

  const final = await waitForFinalState(jobId);
  check('job cuyo fetchRows falla termina en error', final.status === 'error');
  check('job en error trae el mensaje real', final.errorMessage === 'fallo simulado de red');
}

// --- 5. Job inexistente -> error explicito, nunca silencioso ---

async function testUnknownJob() {
  const state = await getExportJobStatus('jobid-que-no-existe');
  check('getExportJobStatus de un jobId inexistente devuelve error explicito', state.status === 'error' && typeof state.errorMessage === 'string' && state.errorMessage.length > 0);
}

async function main() {
  await testJobWithRows();
  await testJobEmpty();
  await testJobError();
  await testUnknownJob();

  if (failures > 0) {
    console.log(`\n${failures} verificacion(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nTodas las verificaciones pasaron.');
}

main();
