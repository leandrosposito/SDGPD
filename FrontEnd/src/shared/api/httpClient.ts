import { ApiError, isRetryableApiError, type ApiErrorCode } from './ApiError';
import type { RequestOptions } from './types';

// ============================================================
// httpClient — Punto unico por el que pasa toda peticion del
// frontend (A1/A3/A7/D1, DECISIONES_TECNICAS.md, tanda de
// escalabilidad). Hoy resuelve en modo mock (VITE_API_MODE=mock,
// default): simula latencia de red y, opcionalmente, una tasa de
// fallo, y llama al resolver `mock` que le pasa cada service. El dia
// que exista backend, VITE_API_MODE=http hace que el mismo
// httpClient.request(...) arme un fetch() real contra VITE_API_BASE_URL
// — ningun call-site de ningun service cambia, solo esta variable.
//
// Politica de resiliencia (unica, no una por service):
// - Timeout por defecto 15s (config.timeoutMs lo puede sobreescribir).
// - 2 reintentos con backoff exponencial (300ms, 600ms), SOLO para
//   errores de red/timeout/5xx. Nunca para 4xx (CLIENT_ERROR) ni para
//   una cancelacion explicita (CANCELLED) — reintentar un 4xx repite
//   el mismo error siempre, y reintentar una cancelacion iria contra
//   la intencion de quien cancelo.
// - Cancelacion real con AbortController: `config.signal` (el que le
//   pasa el llamador, p. ej. usePagedQuery) aborta TODOS los intentos
//   en curso, incluidos los que estan esperando el backoff — no solo
//   descarta la respuesta como hacia el patron `cancelled` anterior
//   (ver A3, AUDITORIA_ESCALABILIDAD.md), sino que corta el trabajo
//   en vuelo de verdad (real fetch() abortado en modo http; en modo
//   mock, la espera de latencia simulada se corta al instante).
//
// Logging de diagnostico (VITE_API_DEBUG=true, default false — feature
// PERMANENTE del cliente, no instrumentacion a retirar): registra en
// consola cada `start`/`resolved`/`retry`/`cancelled`/`error` con un id
// corto por peticion, para poder verificar a ojo (o buscar en consola)
// que la politica de reintentos/timeout/cancelacion se comporta como
// se documenta aca arriba, sin depender de la pestaña Network — en
// modo mock (default) nunca se llama a fetch(), asi que Network no
// muestra nada por definicion. Ver docs/VERIFICACION_TANDA_0_1.md.
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
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const BACKOFF_BASE_MS = 300;

const API_MODE = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'mock';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 300);
const MOCK_FAILURE_RATE = Number(import.meta.env.VITE_MOCK_FAILURE_RATE ?? 0);
const API_DEBUG = (import.meta.env.VITE_API_DEBUG as string | undefined) === 'true';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

// ------------------------------------------------------------
// Debug logging (VITE_API_DEBUG) — ver comentario del encabezado.
// `requestId` es un contador corto (no un UUID: esto es para leer en
// consola durante desarrollo, no para correlacionar con un backend
// real) compartido por todos los intentos de una misma peticion, asi
// se puede seguir el hilo "start -> retry -> retry -> error/resolved"
// de un mismo llamado aunque haya varias peticiones en simultaneo.
// ------------------------------------------------------------
let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

type DebugEvent = 'start' | 'resolved' | 'retry' | 'cancelled' | 'error';

function debugLog(requestId: string, event: DebugEvent, details: Record<string, unknown>): void {
  if (!API_DEBUG) return;
  console.log(`[httpClient] ${requestId} ${event}`, details);
}

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

async function runMock<T>(mock: () => Promise<T> | T, signal: AbortSignal): Promise<T> {
  await abortableDelay(MOCK_LATENCY_MS, signal);

  if (MOCK_FAILURE_RATE > 0 && Math.random() < MOCK_FAILURE_RATE) {
    // Simula una falla de servidor (5xx) — no de red — para poder
    // ejercer el camino completo de reintentos + ApiError con
    // VITE_MOCK_FAILURE_RATE=1 (ver AUDITORIA_ESCALABILIDAD.md,
    // hallazgo #7: este camino nunca se habia probado ni una vez).
    throw new ApiError(503, 'SERVER_ERROR', 'Error simulado (VITE_MOCK_FAILURE_RATE).');
  }

  return await mock();
}

async function runHttp<T>(config: HttpRequestConfig<T>, signal: AbortSignal): Promise<T> {
  // Base siempre con "/" final: new URL() trata un base sin "/" final
  // como si su ultimo segmento fuera un archivo y lo descarta al
  // resolver el path relativo (ej. ".../v1" + "suppliers" -> ".../suppliers",
  // perdiendo "v1") — normalizar evita ese gotcha el dia que
  // VITE_API_BASE_URL tenga un sufijo de version.
  const base = (API_BASE_URL || window.location.origin).replace(/\/?$/, '/');
  const url = new URL(config.path.replace(/^\//, ''), base);
  if (config.params) {
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: config.method,
      headers: config.body ? { 'Content-Type': 'application/json' } : undefined,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err; // se reclasifica mas arriba (timeout vs. cancelado)
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
  }

  if (!response.ok) {
    const code: ApiErrorCode = response.status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR';
    throw new ApiError(response.status, code, `Error ${response.status} al llamar a ${config.path}.`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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

async function requestOnce<T>(
  config: HttpRequestConfig<T>,
  timeoutMs: number
): Promise<T> {
  const { signal, didTimeOut, cleanup } = withTimeout(config.signal, timeoutMs);
  try {
    return API_MODE === 'http' ? await runHttp(config, signal) : await runMock(config.mock, signal);
  } catch (err) {
    throw toApiError(err, didTimeOut(), config.signal?.aborted ?? false);
  } finally {
    cleanup();
  }
}

export const httpClient = {
  async request<T>(config: HttpRequestConfig<T>): Promise<T> {
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = config.retries ?? DEFAULT_RETRIES;
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
        const apiError = err as ApiError;

        if (apiError.code === 'CANCELLED') {
          debugLog(requestId, 'cancelled', { attempt });
          throw apiError;
        }

        const canRetry = attempt < retries && isRetryableApiError(apiError);
        if (!canRetry) {
          debugLog(requestId, 'error', { attempt, status: apiError.status, code: apiError.code, message: apiError.message });
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
