import { createHttpClient } from './httpClientCore';

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
export type { HttpMethod, HttpRequestConfig } from './httpClientCore';

const API_MODE = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'mock';

export const httpClient = createHttpClient({
  mode: API_MODE === 'http' ? 'http' : 'mock',
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '',
  mockLatencyMs: Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 300),
  mockFailureRate: Number(import.meta.env.VITE_MOCK_FAILURE_RATE ?? 0),
  debug: (import.meta.env.VITE_API_DEBUG as string | undefined) === 'true',
});
