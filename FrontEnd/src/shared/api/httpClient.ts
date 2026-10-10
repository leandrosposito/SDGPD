import { createHttpClient, type RefreshLock } from './httpClientCore';
import { parseHttpServices, type ServiceName } from './serviceModes';
import { getAccessToken, notifySessionExpired, setAccessToken } from '@/shared/auth/tokenStore';

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
// - BE-0b: GET se reintenta como siempre; POST/PUT/PATCH/DELETE SOLO si
//   llevan `idempotencyKey` (ADR-BE-005; cierra A2 del lado del
//   cliente). En modo http la clave viaja como header `Idempotency-Key`,
//   y el cuerpo de error `{ code, message, details }` llega a ApiError.
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

// La logica vive en httpClientCore.ts (createHttpClient), sin
// import.meta.env, para poder ejercitarla con `node` (BE-0b). Aca solo
// se lee la configuracion de Vite.
//
// BE-1b: el modo es POR SERVICE. VITE_HTTP_SERVICES (serviceModes.ts) es
// el UNICO lugar que dice que services van por http contra el backend; el
// resto sigue en mock. VITE_API_MODE=http (modo global, de antes de BE-1b)
// se conserva solo como escape para probar TODO contra un backend completo:
// hoy romperia los modulos que el backend todavia no sirve.
// VITE_API_BASE_URL: por defecto '/api', el prefijo global del backend, en el
// mismo origen (en desarrollo, el proxy de Vite lo manda al backend sin
// reescribir la ruta; ver vite.config.ts).
export type { HttpMethod, HttpRequestConfig } from './httpClientCore';

const API_MODE = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'mock';

export const httpServices: ReadonlySet<ServiceName> = parseHttpServices(
  import.meta.env.VITE_HTTP_SERVICES as string | undefined
);

export function isHttpService(service: ServiceName): boolean {
  return API_MODE === 'http' || httpServices.has(service);
}

const API_DEBUG = (import.meta.env.VITE_API_DEBUG as string | undefined) === 'true';

// BE-1c: el refresh se serializa entre pestanas con la Web Locks API. Si el
// navegador no la tiene, se sigue sin lock (como en BE-1b) y se avisa UNA vez
// por consola en modo debug. Sin polyfill.
function browserRefreshLock(): RefreshLock | undefined {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    const locks = navigator.locks;
    return (name, fn) => locks.request(name, () => fn());
  }
  if (API_DEBUG) {
    console.warn('[httpClient] navigator.locks no existe: el refresh no se coordina entre pestanas (dos a la vez pueden cerrar la sesion).');
  }
  return undefined;
}

export const httpClient = createHttpClient({
  mode: API_MODE === 'http' ? 'http' : 'mock',
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api',
  mockLatencyMs: Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 300),
  mockFailureRate: Number(import.meta.env.VITE_MOCK_FAILURE_RATE ?? 0),
  debug: API_DEBUG,
  httpServices,
  // Solo con auth por http hay token y refresh; en mock no se manda nada.
  auth: isHttpService('auth')
    ? {
        getAccessToken,
        setAccessToken,
        refreshPath: 'auth/refresh',
        onSessionExpired: notifySessionExpired,
        lock: browserRefreshLock(),
      }
    : undefined,
});
