// ============================================================
// Smoke script — BE-0b (parte frontend). Ejercita el codigo REAL de
// shared/api/httpClientCore.ts (createHttpClient, el mismo que usa
// httpClient.ts con la configuracion de Vite) contra un servidor HTTP
// local de Node, y los constructores de shared/types/ids.types.ts:
// - POST sin idempotencyKey no se reintenta;
// - POST con idempotencyKey se reintenta y manda Idempotency-Key en cada intento;
// - GET se reintenta como antes;
// - el cuerpo de error { code, message, details } llega a ApiError; uno sin esa forma no;
// - lo que no cambio: timeout, cancelacion con AbortController, modo mock;
// - el validador de ids acepta UUID y el prefijo legado, y rechaza el resto.
//
// Correr con: node scripts/smoke/be-0b.smoke.mjs (desde FrontEnd/).
// ============================================================

import { createServer } from 'node:http';
import { createHttpClient, IDEMPOTENCY_KEY_HEADER } from '../../src/shared/api/httpClientCore.ts';
import { ApiError } from '../../src/shared/api/ApiError.ts';
import { asDriverId, asOrderId, isOrderId, isTripId, isVehicleId } from '../../src/shared/types/ids.types.ts';

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

// --- Servidor local: cuenta los intentos por ruta y guarda el header de cada uno ---
const hits = new Map();
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const list = hits.get(path) ?? [];
  list.push({ method: req.method, key: req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] });
  hits.set(path, list);
  req.resume();
  if (path === '/fail') {
    res.writeHead(503, { 'Content-Type': 'text/plain' }).end('caido');
  } else if (path === '/contract-error') {
    res
      .writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ code: 'version-conflict', message: 'La sucursal cambio', details: { currentVersion: 3 } }));
  } else if (path === '/other-error') {
    res.writeHead(422, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'otra forma' }));
  } else if (path === '/slow') {
    setTimeout(() => res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}'), 500);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const http = createHttpClient({ mode: 'http', baseUrl, mockLatencyMs: 0, mockFailureRate: 0, debug: false });
const neverMock = () => {
  throw new Error('modo http: el mock no se llama');
};

async function attempt(config) {
  try {
    return { result: await http.request({ mock: neverMock, ...config }) };
  } catch (error) {
    return { error };
  }
}

const KEY = '01a12095-096f-7786-a869-ea59d94a1571';

console.log('--- reintentos (ADR-BE-005, A2 del lado del cliente) ---');
{
  const r = await attempt({ method: 'POST', path: '/fail?case=post-sin-clave', body: { a: 1 } });
  const h = hits.get('/fail') ?? [];
  check('POST sin clave: un solo intento', h.length === 1);
  check('POST sin clave: falla con ApiError 503 SERVER_ERROR', r.error instanceof ApiError && r.error.status === 503 && r.error.code === 'SERVER_ERROR');
  check('POST sin clave: no manda Idempotency-Key', h[0]?.key === undefined);
  hits.delete('/fail');
}
{
  await attempt({ method: 'POST', path: '/fail', body: { a: 1 }, idempotencyKey: KEY });
  const h = hits.get('/fail') ?? [];
  check('POST con clave: 3 intentos (1 + 2 reintentos por defecto)', h.length === 3);
  check('POST con clave: la misma Idempotency-Key en cada intento', h.length === 3 && h.every(x => x.key === KEY));
  hits.delete('/fail');
}
{
  await attempt({ method: 'PUT', path: '/fail', body: { a: 1 }, idempotencyKey: KEY, retries: 1 });
  const h = hits.get('/fail') ?? [];
  check('PUT con clave y retries: 1 -> 2 intentos', h.length === 2 && h.every(x => x.method === 'PUT' && x.key === KEY));
  hits.delete('/fail');
}
{
  await attempt({ method: 'DELETE', path: '/fail' });
  check('DELETE sin clave: un solo intento', (hits.get('/fail') ?? []).length === 1);
  hits.delete('/fail');
}
{
  await attempt({ method: 'GET', path: '/fail' });
  const h = hits.get('/fail') ?? [];
  check('GET: 3 intentos, como antes', h.length === 3);
  check('GET: sin Idempotency-Key', h.every(x => x.key === undefined));
  hits.delete('/fail');
}

console.log('--- cuerpo de error (ADR-BE-004) ---');
{
  const { error } = await attempt({ method: 'PUT', path: '/contract-error', body: { v: 1 }, idempotencyKey: KEY });
  check('cuerpo del contrato: status 409 y code CLIENT_ERROR (clasificacion del cliente)', error instanceof ApiError && error.status === 409 && error.code === 'CLIENT_ERROR');
  check('cuerpo del contrato: serverCode version-conflict', error?.serverCode === 'version-conflict');
  check('cuerpo del contrato: message del servidor', error?.message === 'La sucursal cambio');
  check('cuerpo del contrato: details.currentVersion 3', error?.details?.currentVersion === 3);
  check('4xx con clave: no se reintenta', (hits.get('/contract-error') ?? []).length === 1);
}
{
  const { error } = await attempt({ method: 'GET', path: '/other-error' });
  check('cuerpo con otra forma: mensaje generico de antes', error instanceof ApiError && error.message === 'Error 422 al llamar a /other-error.');
  check('cuerpo con otra forma: sin serverCode ni details', error?.serverCode === undefined && error?.details === undefined);
}
{
  const { error } = await attempt({ method: 'GET', path: '/fail' });
  check('5xx en texto plano: mensaje generico, sin serverCode', error instanceof ApiError && error.message === 'Error 503 al llamar a /fail.' && error.serverCode === undefined);
  hits.delete('/fail');
}

console.log('--- lo que no cambio: timeout, cancelacion, modo mock ---');
{
  const { error } = await attempt({ method: 'GET', path: '/slow', timeoutMs: 50, retries: 0 });
  check('timeout: ApiError TIMEOUT', error instanceof ApiError && error.code === 'TIMEOUT');
}
{
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  const { error } = await attempt({ method: 'GET', path: '/slow', signal: controller.signal });
  check('AbortController: ApiError CANCELLED, sin reintento', error instanceof ApiError && error.code === 'CANCELLED');
}
{
  const mock = createHttpClient({ mode: 'mock', baseUrl: '', mockLatencyMs: 0, mockFailureRate: 0, debug: false });
  const before = hits.size;
  const result = await mock.request({ method: 'POST', path: '/no-se-llama', body: {}, idempotencyKey: KEY, mock: () => ({ id: 'ord-001' }) });
  check('modo mock: devuelve el resolver y no toca la red', result.id === 'ord-001' && hits.size === before);
  let mockCalls = 0;
  const failing = createHttpClient({ mode: 'mock', baseUrl: '', mockLatencyMs: 0, mockFailureRate: 1, debug: false });
  let failed;
  try {
    await failing.request({ method: 'GET', path: '/x', mock: () => (mockCalls++, 1) });
  } catch (error) {
    failed = error;
  }
  check('modo mock con VITE_MOCK_FAILURE_RATE=1: 503 simulado, el resolver no corre', failed instanceof ApiError && failed.status === 503 && mockCalls === 0);
}

console.log('--- validador de ids (ADR-BE-004, sub-decision 1) ---');
const UUID_V7 = '01a12095-096f-7786-a869-ea59d94a1571';
check('UUID v7 es OrderId', isOrderId(UUID_V7));
check('UUID v4 en mayusculas es TripId', isTripId('3F2504E0-4F89-41D3-9A0C-0305E82C3301'));
check('prefijo legado ord-001 es OrderId', isOrderId('ord-001'));
check('prefijo legado veh-1 es VehicleId', isVehicleId('veh-1'));
check('prefijo de otro tipo (cli-001) no es OrderId', !isOrderId('cli-001'));
check('texto suelto no es OrderId', !isOrderId('pedido-1'));
check('vacio no es OrderId', !isOrderId(''));
check('UUID con un caracter de menos no es OrderId', !isOrderId(UUID_V7.slice(1)));
check('UUID con espacios no es OrderId', !isOrderId(` ${UUID_V7}`));
check('UUID sin guiones no es OrderId', !isOrderId(UUID_V7.replaceAll('-', '')));
check('asOrderId(UUID) devuelve el mismo string', asOrderId(UUID_V7) === UUID_V7);
let threw = false;
try {
  asDriverId('cualquier-cosa');
} catch {
  threw = true;
}
check('asDriverId rechaza lo que no es UUID ni drv-', threw);

server.close();
console.log('');
if (failures > 0) {
  console.log(`${failures} chequeo(s) fallaron`);
  process.exit(1);
}
console.log('todos los chequeos pasaron');
