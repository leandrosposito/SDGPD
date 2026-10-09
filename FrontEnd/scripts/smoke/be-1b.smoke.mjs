// ============================================================
// Smoke script — BE-1b, Parte 2 punto 7. Ejercita el codigo REAL de
// shared/api/httpClientCore.ts (createHttpClient, el mismo que usa
// httpClient.ts) y shared/api/serviceModes.ts contra un servidor HTTP
// local de Node:
// - un 401 dispara UN solo refresh aunque haya 3 requests en paralelo, y
//   los 3 se reintentan UNA vez, con el token nuevo;
// - un refresh fallido no se reintenta en loop: 1 refresh, los 3 fallan
//   con 401, se avisa onSessionExpired una vez y el token se borra;
// - el refresh va con X-Requested-With y sin Bearer; un 401 de un request
//   con auth 'none' no dispara refresh;
// - modo por service: un service no declarado sigue en mock (no toca la red);
// - parseHttpServices: lista valida, nombres desconocidos y coherencia.
//
// Correr con: node scripts/smoke/be-1b.smoke.mjs (desde FrontEnd/).
// ============================================================

import { createServer } from 'node:http';
import { createHttpClient } from '../../src/shared/api/httpClientCore.ts';
import { ApiError } from '../../src/shared/api/ApiError.ts';
import { parseHttpServices, ServiceModesError } from '../../src/shared/api/serviceModes.ts';

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

// --- Servidor: /api/data/<n> exige Bearer <current>; /api/auth/refresh rota el token o falla ---
let current = 't-nuevo';
let refreshMode = 'ok';
const counts = { refresh: 0, data: new Map(), refreshHeaders: [] };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  req.resume();
  const json = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  if (path === '/api/auth/refresh') {
    counts.refresh++;
    counts.refreshHeaders.push({ requestedWith: req.headers['x-requested-with'], authorization: req.headers.authorization });
    // Un poco de demora: los 3 requests tienen que esperar el MISMO refresh, no ganarle.
    setTimeout(() => {
      if (refreshMode === 'ok') json(200, { accessToken: current, tokenType: 'Bearer', expiresAt: '2026-10-09T12:00:00.000Z' });
      else json(401, { code: 'unauthenticated', message: 'Hace falta una sesion' });
    }, 50);
    return;
  }
  if (path.startsWith('/api/data/') || path === '/api/public') {
    counts.data.set(path, (counts.data.get(path) ?? 0) + 1);
    if (req.headers.authorization === `Bearer ${current}`) json(200, { ok: path });
    else json(401, { code: 'unauthenticated', message: 'Hace falta una sesion' });
    return;
  }
  json(404, { code: 'not-found', message: 'no existe' });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

let token = 't-vencido';
let expired = 0;
const http = createHttpClient({
  mode: 'mock',
  baseUrl,
  mockLatencyMs: 0,
  mockFailureRate: 0,
  debug: false,
  httpServices: parseHttpServices('auth,session,users'),
  auth: {
    getAccessToken: () => token,
    setAccessToken: (t) => {
      token = t;
    },
    refreshPath: 'auth/refresh',
    onSessionExpired: () => {
      expired++;
    },
  },
});
const neverMock = () => {
  throw new Error('service por http: el mock no se llama');
};
const get = (n, extra = {}) => http.request({ method: 'GET', path: `data/${n}`, service: 'session', mock: neverMock, ...extra });

// --- 1. Tres requests en paralelo con el token vencido: UN refresh, cada uno reintenta UNA vez ---
const results = await Promise.allSettled([get(1), get(2), get(3)]);
check('los 3 requests en paralelo terminan bien despues del refresh', results.every((r) => r.status === 'fulfilled'));
check(`un solo refresh para los 3 (hubo ${counts.refresh})`, counts.refresh === 1);
check(
  'cada request se reintento una sola vez (2 llegadas: 401 y 200)',
  [1, 2, 3].every((n) => counts.data.get(`/api/data/${n}`) === 2)
);
check('el token nuevo quedo guardado', token === 't-nuevo');
check(
  'el refresh lleva X-Requested-With y no lleva Bearer',
  counts.refreshHeaders[0]?.requestedWith === 'XMLHttpRequest' && counts.refreshHeaders[0]?.authorization === undefined
);
check('con el token vigente no hay refresh', (await get(4)) && counts.refresh === 1 && counts.data.get('/api/data/4') === 1);

// --- 2. Refresh fallido: no se reintenta en loop ---
token = 't-vencido';
current = 't-otro';
refreshMode = 'fail';
counts.refresh = 0;
counts.data.clear();
const failed = await Promise.allSettled([get(5), get(6), get(7)]);
check(
  'con el refresh fallido, los 3 fallan con 401',
  failed.every((r) => r.status === 'rejected' && r.reason instanceof ApiError && r.reason.status === 401)
);
check(`un solo intento de refresh, sin loop (hubo ${counts.refresh})`, counts.refresh === 1);
check('cada request llego una sola vez (no se reintenta sin token)', [5, 6, 7].every((n) => counts.data.get(`/api/data/${n}`) === 1));
check(`se aviso onSessionExpired una vez (${expired})`, expired === 1);
check('el token se borro', token === null);

// --- 3. Un request con auth 'none' que recibe 401 no dispara refresh ---
counts.refresh = 0;
const none = await http
  .request({ method: 'GET', path: 'public', service: 'auth', auth: 'none', mock: neverMock })
  .catch((e) => e);
check("auth 'none' con 401: falla sin refresh", none instanceof ApiError && none.status === 401 && counts.refresh === 0);

// --- 4. Modo por service: lo no declarado sigue en mock ---
const before = counts.data.size;
const mocked = await http.request({ method: 'GET', path: 'data/99', service: 'orders', mock: () => ({ mock: true }) });
const unnamed = await http.request({ method: 'GET', path: 'data/98', mock: () => ({ mock: 'sin service' }) });
check('un service no declarado (orders) responde el mock', mocked.mock === true);
check('un request sin service responde el mock', unnamed.mock === 'sin service');
check('ninguno de los dos toco la red', counts.data.size === before && !counts.data.has('/api/data/99'));

// --- 5. parseHttpServices ---
const throwsWith = (raw, fragment) => {
  try {
    parseHttpServices(raw);
    return false;
  } catch (e) {
    return e instanceof ServiceModesError && e.message.includes(fragment);
  }
};
check('vacia o sin definir: ningun service por http', parseHttpServices(undefined).size === 0 && parseHttpServices(' ').size === 0);
check(
  'la lista de BE-1b se acepta, con espacios',
  [...parseHttpServices(' auth, session ,users,roles,branches')].sort().join(',') === 'auth,branches,roles,session,users'
);
check('un service desconocido es un error (orders no esta conectado)', throwsWith('auth,session,orders', '"orders"'));
check('auth sin session es un error', throwsWith('auth', '"auth" y "session"'));
check('users sin auth es un error', throwsWith('users', '"users" necesita "auth"'));

server.close();
console.log(failures === 0 ? '\ntodos los chequeos pasaron' : `\n${failures} chequeo(s) fallaron`);
process.exitCode = failures === 0 ? 0 : 1;
