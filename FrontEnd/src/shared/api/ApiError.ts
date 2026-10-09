// ============================================================
// ApiError — Error tipado del cliente HTTP (httpClient.ts). Permite
// que la UI distinga "no autorizado" (401/403) de "servidor caido"
// (5xx) de "timeout"/"cancelado" (status 0), sin parsear el mensaje.
//
// `status` sigue la convencion HTTP (0 para lo que nunca llego a
// tener una respuesta con status: timeout, red caida, cancelacion).
// Extiende Error (no una clase nueva sin relacion) para que el
// patron ya usado en todo el proyecto (`err instanceof Error ? err.message : ...`,
// ver SupplierFormModal.tsx/ProductFormModal.tsx/etc.) siga funcionando
// sin cambios en los componentes que atrapan errores de forma generica.
// ============================================================

export type ApiErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'CANCELLED'
  | 'CLIENT_ERROR' // 4xx — nunca se reintenta
  | 'SERVER_ERROR' // 5xx — se reintenta
  | 'UNKNOWN';

// BE-0b (ADR-BE-004 › Errores): en modo http, si el servidor responde con
// el cuerpo de error del contrato `{ code, message, details? }`, ese `code`
// llega en `serverCode` (vocabulario kebab-case del backend, ej.
// `version-conflict`), su `message` reemplaza al generico y `details` viaja
// tal cual. `code` NO cambia de significado: sigue siendo la clasificacion
// del cliente (TIMEOUT/CLIENT_ERROR/...), que es lo que decide los
// reintentos — por eso el codigo del servidor va en un campo aparte.
export interface ApiErrorServerBody {
  serverCode: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly serverCode?: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ApiErrorCode, message: string, server?: ApiErrorServerBody) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (server) {
      this.serverCode = server.serverCode;
      if (server.details) this.details = server.details;
    }
  }
}

// Un error es reintentable segun la politica del proyecto (httpClient.ts):
// SOLO errores de red y 5xx. Nunca 4xx, nunca una cancelacion explicita.
export function isRetryableApiError(error: ApiError): boolean {
  return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'SERVER_ERROR';
}
