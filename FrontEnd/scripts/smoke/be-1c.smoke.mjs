// ============================================================
// Smoke script — BE-1c, Parte 1: refresh entre pestanas. Ejercita el codigo
// REAL de shared/api/httpClientCore.ts contra un servidor HTTP local de Node
// que rota el refresh token y detecta el reuso IGUAL que el backend
// (BackEnd/src/db/auth-store.ts#rotateRefreshToken): cada token sirve una
// sola vez, se marca usado de forma atomica al llegar, y presentar uno ya
// usado revoca la familia entera. El access token emitido sigue valiendo
// hasta su vencimiento (un JWT no se revoca), pero la familia ya no refresca.
//
// Dos "pestanas" = dos clientes, cada uno con su access token en memoria,
// que comparten UN frasco de cookies (como dos pestanas del mismo navegador).
// El lock se inyecta (en el navegador es navigator.locks.request):
// - control, con un lock que NO bloquea: las dos refrescan a la vez con la
//   misma cookie, el servidor ve un reuso y revoca la familia — una pestana
//   pierde la sesion (este escenario TIENE que mostrar el fallo);
// - con un lock real que serializa: la segunda espera a la primera y refresca
//   con la cookie ya rotada; las dos terminan con sesion valida. Igual para
//   el refresh del arranque de la app (refreshAccessToken directo).
//
// Correr con: node scripts/smoke/be-1c.smoke.mjs (desde FrontEnd/).
// ============================================================

import { createServer } from 'node:http';
import { createHttpClient, REFRESH_LOCK_NAME } from '../../src/shared/api/httpClientCore.ts';
import { parseHttpServices } from '../../src/shared/api/serviceModes.ts';

let failures = 0;
function check(description, condition) {
  if (condition) {
    console.log(`OK   ${description}`);
  } else {
    console.log(`FAIL ${description}`);
    failures++;
  }
}

// --- Servidor con rotacion y deteccion de reuso ---
let state;
function resetServer() {
  state = { refreshTokens: new Map(), revokedFamilies: new Set(), validAccess: new Set(), seq: 0, refreshCalls: 0, inFlight: 0, maxInFlight: 0, reuses: 0 };
  state.refreshTokens.set('r-0', { family: 'F', used: false });
}
const cookieOf = (header) => /(?:^|;\s*)sdgpd_refresh=([^;]*)/.exec(header ?? '')?.[1];

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  req.resume();
  const json = (status, body, headers = {}) =>
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers }).end(JSON.stringify(body));
  if (path === '/api/auth/refresh') {
    state.refreshCalls++;
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    const token = cookieOf(req.headers.cookie);
    const entry = token ? state.refreshTokens.get(token) : undefined;
    // Decision atomica al llegar (en el backend: UPDATE ... WHERE used_at IS NULL).
    let outcome;
    if (!entry || state.revokedFamilies.has(entry.family) || req.headers['x-requested-with'] !== 'XMLHttpRequest') outcome = 'invalid';
    else if (entry.used) {
      state.revokedFamilies.add(entry.family);
      state.reuses++;
      outcome = 'reused';
    } else {
      entry.used = true;
      outcome = 'rotated';
    }
    // Demora: los dos refresh tienen que poder solaparse si nada los serializa.
    setTimeout(() => {
      state.inFlight--;
      if (outcome !== 'rotated') {
        json(401, { code: 'unauthenticated', message: 'Hace falta una sesion' }, { 'Set-Cookie': 'sdgpd_refresh=; Path=/api/auth/refresh; Max-Age=0' });
        return;
      }
      state.seq++;
      const next = `r-${state.seq}`;
      const access = `a-${state.seq}`;
      state.refreshTokens.set(next, { family: entry.family, used: false });
      state.validAccess.add(access);
      json(
        200,
        { accessToken: access, tokenType: 'Bearer', expiresAt: '2026-10-09T12:00:00.000Z' },
        { 'Set-Cookie': `sdgpd_refresh=${next}; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict` }
      );
    }, 60);
    return;
  }
  if (path === '/api/data') {
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (state.validAccess.has(bearer)) json(200, { ok: true });
    else json(401, { code: 'unauthenticated', message: 'Hace falta una sesion' });
    return;
  }
  json(404, { code: 'not-found', message: 'no existe' });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

// --- Un "navegador": un frasco de cookies compartido por todas sus pestanas ---
function makeBrowser() {
  const jar = { refresh: 'r-0' };
  const fetchImpl = async (url, init = {}) => {
    const headers = { ...(init.headers ?? {}) };
    if (jar.refresh) headers.Cookie = `sdgpd_refresh=${jar.refresh}`;
    const response = await fetch(url, { ...init, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) jar.refresh = cookieOf(setCookie) || undefined;
    return response;
  };
  return { jar, fetchImpl };
}

// Lock que no bloquea (control) y lock real que serializa (como navigator.locks).
const noLock = (_name, fn) => fn();
function makeMutex() {
  const stats = { names: new Set() };
  let tail = Promise.resolve();
  const lock = (name, fn) => {
    stats.names.add(name);
    const run = tail.then(() => fn());
    tail = run.catch(() => undefined);
    return run;
  };
  return { lock, stats };
}

function makeTab(browser, lock) {
  const tab = { token: 'a-vencido', expired: 0 };
  tab.client = createHttpClient({
    mode: 'mock',
    baseUrl,
    mockLatencyMs: 0,
    mockFailureRate: 0,
    debug: false,
    httpServices: parseHttpServices('auth,session'),
    fetchImpl: browser.fetchImpl,
    auth: {
      getAccessToken: () => tab.token,
      setAccessToken: (t) => {
        tab.token = t;
      },
      refreshPath: 'auth/refresh',
      onSessionExpired: () => {
        tab.expired++;
      },
      lock,
    },
  });
  tab.get = () =>
    tab.client.request({ method: 'GET', path: 'data', service: 'session', mock: () => { throw new Error('no mock'); } });
  return tab;
}

async function bothTabs(lock, how) {
  resetServer();
  const browser = makeBrowser();
  const a = makeTab(browser, lock);
  const b = makeTab(browser, lock);
  const results =
    how === 'arranque'
      ? await Promise.all([a.client.refreshAccessToken(), b.client.refreshAccessToken()])
      : (await Promise.allSettled([a.get(), b.get()])).map((r) => r.status === 'fulfilled');
  // Despues, cada pestana tiene que poder seguir: un request mas con su token.
  const after = (await Promise.allSettled([a.get(), b.get()])).map((r) => r.status === 'fulfilled');
  // Y la familia tiene que poder seguir refrescando (la proxima vez que venza el token).
  const nextRefresh = await a.client.refreshAccessToken();
  return { results, after, nextRefresh, a, b, browser, server: { ...state } };
}

// --- 1. Control: SIN lock, las dos pestanas refrescan a la vez (un 401 cada una) ---
const control = await bothTabs(noLock, '401');
check(`control sin lock: los dos refresh se solaparon en el servidor (maximo en vuelo: ${control.server.maxInFlight})`, control.server.maxInFlight === 2);
check(`control sin lock: el servidor vio un reuso y revoco la familia (${control.server.reuses} reuso)`, control.server.reuses === 1 && control.server.revokedFamilies.has('F'));
check(
  `control sin lock: una pestana perdio la sesion (onSessionExpired: A=${control.a.expired}, B=${control.b.expired})`,
  control.a.expired + control.b.expired >= 1
);
check('control sin lock: la familia ya no refresca (el proximo vencimiento cierra la sesion)', control.nextRefresh === false);

// --- 2. Con un lock real que serializa: las dos terminan con sesion valida ---
const mutex = makeMutex();
const locked = await bothTabs(mutex.lock, '401');
check(`con lock: los refresh NO se solaparon (maximo en vuelo: ${locked.server.maxInFlight})`, locked.server.maxInFlight === 1);
check(`con lock: ningun reuso, la familia sigue viva (reusos: ${locked.server.reuses})`, locked.server.reuses === 0 && locked.server.revokedFamilies.size === 0);
check('con lock: los dos requests terminaron bien despues del refresh', locked.results.every(Boolean));
check('con lock: ninguna pestana perdio la sesion', locked.a.expired === 0 && locked.b.expired === 0);
check('con lock: las dos siguen pudiendo hacer requests', locked.after.every(Boolean));
check('con lock: la familia sigue refrescando', locked.nextRefresh === true);
check(`el lock se pide con el nombre fijo ${REFRESH_LOCK_NAME}`, [...mutex.stats.names].join(',') === REFRESH_LOCK_NAME);

// --- 3. El refresh del arranque (dos pestanas que se recargan a la vez) ---
const bootControl = await bothTabs(noLock, 'arranque');
check('arranque sin lock: dos recargas a la vez revocan la familia (control)', bootControl.server.reuses === 1 && !bootControl.results.every(Boolean));
const boot = await bothTabs(makeMutex().lock, 'arranque');
check('arranque con lock: las dos pestanas recargadas a la vez quedan con sesion', boot.results.every(Boolean) && boot.after.every(Boolean));
check('arranque con lock: ningun reuso y la familia sigue refrescando', boot.server.reuses === 0 && boot.nextRefresh === true);

// --- 4. El single-flight por pestana se mantiene adentro del lock ---
resetServer();
const one = makeTab(makeBrowser(), makeMutex().lock);
const three = await Promise.allSettled([one.get(), one.get(), one.get()]);
check(`una pestana con 3 requests en paralelo: un solo refresh (${state.refreshCalls})`, state.refreshCalls === 1 && three.every((r) => r.status === 'fulfilled'));

server.close();
console.log(failures === 0 ? '\ntodos los chequeos pasaron' : `\n${failures} chequeo(s) fallaron`);
process.exitCode = failures === 0 ? 0 : 1;
