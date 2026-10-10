import { ApiError, isRetryableApiError, type ApiErrorCode, type ApiErrorServerBody } from './ApiError.ts';
import type { RequestOptions } from './types.ts';

// ============================================================
// httpClientCore — la logica de httpClient (ver el encabezado de
// httpClient.ts para la politica completa), separada de la lectura de
// `import.meta.env` (BE-0b): `createHttpClient(settings)` recibe la
// configuracion ya resuelta, asi que corre igual en Vite y en `node`
// puro — el smoke scripts/smoke/be-0b.smoke.mjs ejercita ESTE codigo
// contra un servidor HTTP local, no una copia.
//
// Cambios de BE-0b (ADR-BE-004 › Errores, ADR-BE-005 › Idempotencia):
// - Modo http: el cuerpo de error `{ code, message, details? }` llega a
//   ApiError (serverCode, message, details y status). Si el cuerpo no
//   tiene esa forma, se conserva el mensaje generico de antes.
// - `idempotencyKey` viaja como header `Idempotency-Key`.
// - Reintentos: GET como antes; POST/PUT/PATCH/DELETE SOLO si llevan
//   `idempotencyKey` (cierra A2 del lado del cliente: un reintento sin
//   clave puede duplicar el efecto).
//
// Cambios de BE-1b (ADR-BE-003 › Consecuencias para el frontend):
// - Modo POR SERVICE: cada request declara su `service`; va por http si
//   ese service esta en `settings.httpServices` (VITE_HTTP_SERVICES, ver
//   serviceModes.ts), o si el modo global es 'http'. El resto, mock.
// - `Authorization: Bearer <token>` con el access token en memoria
//   (`settings.auth.getAccessToken`, nunca storage), salvo `auth: 'none'`.
// - Ante un 401 de un request con Bearer: UN solo refresh a la vez
//   (single-flight: dos refresh en paralelo con la misma cookie cuentan
//   como reuso y el servidor revoca la familia) y UN unico reintento del
//   request. Si el refresh falla, el token se borra y se avisa
//   `onSessionExpired` (la app vuelve al login); el refresh fallido no se
//   reintenta.
// - El refresh va a `settings.auth.refreshPath` con credentials 'include'
//   (la cookie HttpOnly, Path=/api/auth/refresh) y X-Requested-With.
// ============================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestConfig<T> extends RequestOptions {
  method: HttpMethod;
  // Path relativo a VITE_API_BASE_URL (modo http). Ignorado en modo
  // mock, pero igual se pide siempre: documenta contra que endpoint
  // real va a pegar este call-site el dia que exista backend.
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  // Resolver mock — computa el resultado ya filtrado/paginado/ordenado
  // (misma responsabilidad que hoy tienen services/mock/*.ts). Nunca
  // simula latencia/fallo el mismo resolver: eso lo hace httpClient,
  // para no repetir esa logica en cada uno de los ~20 services.
  mock: () => Promise<T> | T;
  // BE-1b: service al que pertenece el request (serviceModes.ts). Decide
  // si va por http o por mock. Sin service, solo el modo global.
  service?: string;
  // 'none': sin Authorization y sin refresh ante un 401 (login, refresh).
  auth?: 'bearer' | 'none';
  // credentials 'include' (solo el refresh y el logout: la cookie HttpOnly).
  withCredentials?: boolean;
  headers?: Record<string, string>;
}

// BE-1b: como obtiene y renueva el access token. Solo existe cuando 'auth'
// va por http; el token vive en memoria (shared/auth/tokenStore.ts).
export interface HttpClientAuth {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  // Path del refresh, relativo a baseUrl (`auth/refresh`).
  refreshPath: string;
  // El refresh fallo: la sesion termino (el llamador vuelve al login).
  onSessionExpired(): void;
  // BE-1c: lock ENTRE PESTANAS del refresh (en el navegador, navigator.locks.request
  // con REFRESH_LOCK_NAME): todas las pestanas comparten la cookie de refresh, y dos
  // refresh a la vez con la misma cookie son un reuso para el servidor, que revoca la
  // familia. Con el lock, el refresh de la segunda pestana espera al de la primera y
  // sale con la cookie ya rotada. Sin lock (navigator.locks no existe), se refresca
  // sin coordinar, como en BE-1b.
  lock?: RefreshLock;
}

/** Corre `fn` con el lock `name` tomado y lo suelta al terminar (la forma de navigator.locks.request). */
export type RefreshLock = (name: string, fn: () => Promise<boolean>) => Promise<boolean>;

/** Nombre fijo del lock del refresh: uno solo en todo el navegador (BE-1c). */
export const REFRESH_LOCK_NAME = 'sdgpd-auth-refresh';

export interface HttpClientSettings {
  mode: 'mock' | 'http';
  // Base de la API en modo http. Vacia: el origin de la pagina.
  baseUrl: string;
  mockLatencyMs: number;
  mockFailureRate: number;
  debug: boolean;
  // BE-1b: services que van por http (los demas, mock), y el manejo del token.
  httpServices?: ReadonlySet<string>;
  auth?: HttpClientAuth;
  // BE-1c: el fetch a usar (por defecto, el global). Solo para el smoke de
  // pestanas, que simula dos pestanas con un frasco de cookies compartido.
  fetchImpl?: typeof fetch;
}

export interface HttpClient {
  request<T>(config: HttpRequestConfig<T>): Promise<T>;
  // BE-1b: renueva el access token con la cookie de refresh. Single-flight:
  // si ya hay un refresh en vuelo, devuelve ese mismo. true si lo renovo.
  refreshAccessToken(): Promise<boolean>;
}

export const REQUESTED_WITH_HEADER = 'X-Requested-With';
export const AUTHORIZATION_HEADER = 'Authorization';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const BACKOFF_BASE_MS = 300;
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

type DebugEvent = 'start' | 'resolved' | 'retry' | 'cancelled' | 'error';

// Delay abortable: a diferencia de un setTimeout suelto, corta de
// inmediato si `signal` se aborta mientras espera — necesario para que
// cancelar una busqueda en vuelo (modo mock) no se quede esperando la
// latencia simulada completa antes de reaccionar.
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

function backoffDelayMs(attempt: number): number {
  return BACKOFF_BASE_MS * 2 ** attempt;
}

// Combina el signal externo (del llamador) con un timeout propio de
// este intento, sin depender de AbortSignal.any (no siempre disponible
// segun el target de compilacion). abort() del combinado dispara si
// cualquiera de los dos lo hace.
function withTimeout(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; didTimeOut: () => boolean; cleanup: () => void } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

// Cuerpo de error del contrato (ADR-BE-004): `{ code, message, details? }`.
// Se valida a mano (sin importar packages/contracts: FrontEnd todavia no
// es workspace) y, si no tiene esa forma, se ignora.
function parseErrorBody(raw: unknown): { message: string; server: ApiErrorServerBody } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const code: unknown = Reflect.get(raw, 'code');
  const message: unknown = Reflect.get(raw, 'message');
  const details: unknown = Reflect.get(raw, 'details');
  if (typeof code !== 'string' || code === '' || typeof message !== 'string' || message === '') return null;
  if (details !== undefined && (typeof details !== 'object' || details === null || Array.isArray(details))) return null;
  const server: ApiErrorServerBody = { serverCode: code };
  if (details !== undefined) server.details = Object.fromEntries(Object.entries(details));
  return { message, server };
}

async function readErrorBody(response: Response): Promise<{ message: string; server: ApiErrorServerBody } | null> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null;
  try {
    return parseErrorBody(await response.json());
  } catch {
    return null;
  }
}

function toApiError(err: unknown, timedOut: boolean, externallyCancelled: boolean): ApiError {
  if (err instanceof ApiError) return err;

  if (isAbortError(err)) {
    if (externallyCancelled) return new ApiError(0, 'CANCELLED', 'Peticion cancelada.');
    if (timedOut) return new ApiError(0, 'TIMEOUT', 'La peticion tardo demasiado.');
    return new ApiError(0, 'CANCELLED', 'Peticion cancelada.');
  }

  return new ApiError(0, 'UNKNOWN', err instanceof Error ? err.message : 'Error desconocido.');
}

// Un GET se puede repetir sin efecto; una mutacion, solo si lleva la
// clave que le permite al servidor reconocer el reintento.
function canRetryMethod(config: RequestOptions & { method: HttpMethod }): boolean {
  return config.method === 'GET' || (config.idempotencyKey !== undefined && config.idempotencyKey !== '');
}

export function createHttpClient(settings: HttpClientSettings): HttpClient {
  // `requestId` es un contador corto (no un UUID: esto es para leer en
  // consola durante desarrollo, no para correlacionar con un backend
  // real) compartido por todos los intentos de una misma peticion.
  let requestCounter = 0;

  function nextRequestId(): string {
    requestCounter += 1;
    return `req-${requestCounter}`;
  }

  function debugLog(requestId: string, event: DebugEvent, details: Record<string, unknown>): void {
    if (!settings.debug) return;
    console.log(`[httpClient] ${requestId} ${event}`, details);
  }

  async function runMock<T>(mock: () => Promise<T> | T, signal: AbortSignal): Promise<T> {
    await abortableDelay(settings.mockLatencyMs, signal);

    if (settings.mockFailureRate > 0 && Math.random() < settings.mockFailureRate) {
      // Simula una falla de servidor (5xx) — no de red — para poder
      // ejercer el camino completo de reintentos + ApiError con
      // VITE_MOCK_FAILURE_RATE=1 (ver AUDITORIA_ESCALABILIDAD.md,
      // hallazgo #7: este camino nunca se habia probado ni una vez).
      throw new ApiError(503, 'SERVER_ERROR', 'Error simulado (VITE_MOCK_FAILURE_RATE).');
    }

    return await mock();
  }

  function isHttp(config: { service?: string }): boolean {
    return settings.mode === 'http' || (config.service !== undefined && (settings.httpServices?.has(config.service) ?? false));
  }

  async function runHttp<T>(config: HttpRequestConfig<T>, signal: AbortSignal): Promise<T> {
    // Base siempre con "/" final: new URL() trata un base sin "/" final
    // como si su ultimo segmento fuera un archivo y lo descarta al
    // resolver el path relativo (ej. ".../v1" + "suppliers" -> ".../suppliers",
    // perdiendo "v1") — normalizar evita ese gotcha el dia que
    // VITE_API_BASE_URL tenga un sufijo de version.
    // BE-1b: baseUrl puede ser relativa al origin ('/api', el default de
    // httpClient.ts, que el proxy de Vite manda al backend sin reescribir).
    const origin = typeof window === 'undefined' ? undefined : window.location.origin;
    const base = new URL((settings.baseUrl || '/').replace(/\/?$/, '/'), origin).toString();
    const url = new URL(config.path.replace(/^\//, ''), base);
    if (config.params) {
      for (const [key, value] of Object.entries(config.params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { ...config.headers };
    if (config.body) headers['Content-Type'] = 'application/json';
    if (config.idempotencyKey) headers[IDEMPOTENCY_KEY_HEADER] = config.idempotencyKey;
    const token = config.auth === 'none' ? null : (settings.auth?.getAccessToken() ?? null);
    if (token) headers[AUTHORIZATION_HEADER] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await (settings.fetchImpl ?? fetch)(url.toString(), {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        credentials: config.withCredentials ? 'include' : 'same-origin',
        signal,
      });
    } catch (err) {
      if (isAbortError(err)) throw err; // se reclasifica mas arriba (timeout vs. cancelado)
      throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
    }

    if (!response.ok) {
      const code: ApiErrorCode = response.status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR';
      const body = await readErrorBody(response);
      if (body) throw new ApiError(response.status, code, body.message, body.server);
      throw new ApiError(response.status, code, `Error ${response.status} al llamar a ${config.path}.`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async function requestOnce<T>(config: HttpRequestConfig<T>, timeoutMs: number): Promise<T> {
    const { signal, didTimeOut, cleanup } = withTimeout(config.signal, timeoutMs);
    try {
      return isHttp(config) ? await runHttp(config, signal) : await runMock(config.mock, signal);
    } catch (err) {
      throw toApiError(err, didTimeOut(), config.signal?.aborted ?? false);
    } finally {
      cleanup();
    }
  }

  // Single-flight del refresh: todos los 401 que llegan mientras hay un
  // refresh en vuelo esperan ESE mismo, en vez de disparar otro (dos refresh
  // con la misma cookie: el segundo es un reuso y revoca la familia). Eso
  // cubre UNA pestana; entre pestanas lo cubre el lock (auth.lock, BE-1c),
  // que envuelve al refresh de esta pestana.
  let refreshInFlight: Promise<boolean> | null = null;

  async function runRefresh(auth: HttpClientAuth): Promise<boolean> {
    try {
      const body = await client.request<unknown>({
        method: 'POST',
        path: auth.refreshPath,
        service: 'auth',
        auth: 'none',
        withCredentials: true,
        headers: { [REQUESTED_WITH_HEADER]: 'XMLHttpRequest' },
        retries: 0,
        mock: () => {
          throw new ApiError(0, 'UNKNOWN', 'El refresh no tiene mock: solo existe con auth por http.');
        },
      });
      const token: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'accessToken') : undefined;
      if (typeof token !== 'string' || token === '') throw new ApiError(0, 'UNKNOWN', 'Respuesta de refresh sin accessToken.');
      auth.setAccessToken(token);
      return true;
    } catch {
      auth.setAccessToken(null);
      auth.onSessionExpired();
      return false;
    }
  }

  function refreshAccessToken(): Promise<boolean> {
    const auth = settings.auth;
    if (!auth) return Promise.resolve(false);
    const run = () => runRefresh(auth);
    refreshInFlight ??= (auth.lock ? auth.lock(REFRESH_LOCK_NAME, run) : run()).finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  const client: HttpClient = {
    refreshAccessToken,

    async request<T>(config: HttpRequestConfig<T>): Promise<T> {
      const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      // Un 401 de un request con Bearer dispara UN refresh y UN reintento.
      let refreshed = false;
      const retries = canRetryMethod(config) ? (config.retries ?? DEFAULT_RETRIES) : 0;
      const requestId = nextRequestId();
      const startedAt = performance.now();

      debugLog(requestId, 'start', { method: config.method, path: config.path, params: config.params });

      for (let attempt = 0; ; attempt++) {
        if (config.signal?.aborted) {
          debugLog(requestId, 'cancelled', { attempt, reason: 'signal ya abortado antes de intentar' });
          throw new ApiError(0, 'CANCELLED', 'Peticion cancelada.');
        }

        try {
          const result = await requestOnce(config, timeoutMs);
          debugLog(requestId, 'resolved', { attempt, durationMs: Math.round(performance.now() - startedAt) });
          return result;
        } catch (err) {
          const apiError = toApiError(err, false, config.signal?.aborted ?? false);

          if (apiError.code === 'CANCELLED') {
            debugLog(requestId, 'cancelled', { attempt });
            throw apiError;
          }

          if (apiError.status === 401 && !refreshed && config.auth !== 'none' && settings.auth && isHttp(config)) {
            refreshed = true;
            debugLog(requestId, 'retry', { attempt, cause: '401: refresh del access token' });
            if (await refreshAccessToken()) {
              attempt--; // el reintento tras el refresh no consume un reintento de red
              continue;
            }
            throw apiError;
          }

          const canRetry = attempt < retries && isRetryableApiError(apiError);
          if (!canRetry) {
            debugLog(requestId, 'error', { attempt, status: apiError.status, code: apiError.code, serverCode: apiError.serverCode, message: apiError.message });
            throw apiError;
          }

          const delayMs = backoffDelayMs(attempt);
          debugLog(requestId, 'retry', { attempt: attempt + 1, afterMs: delayMs, causeCode: apiError.code, causeStatus: apiError.status });

          try {
            await abortableDelay(delayMs, config.signal ?? new AbortController().signal);
          } catch {
            // El signal externo se aborto durante el backoff: no hay
            // timeout involucrado aca, es siempre una cancelacion.
            debugLog(requestId, 'cancelled', { attempt, reason: 'signal abortado durante el backoff' });
            throw new ApiError(0, 'CANCELLED', 'Peticion cancelada.');
          }
        }
      }
    },
  };
  return client;
}
