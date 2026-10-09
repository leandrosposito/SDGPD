// ============================================================
// tokenStore — el access token, SOLO en memoria (BE-1b, ADR-BE-003
// § Decision 1: "guardado en memoria del cliente").
//
// Nunca va a localStorage, sessionStorage ni a una cookie legible: un
// XSS que lea el storage no se lleva la sesion, y al recargar la pagina
// el token se recupera con el refresh (cookie HttpOnly que JS no puede
// leer). Es una variable de modulo, no estado de React ni de zustand:
// la lee httpClient en cada request, fuera de cualquier componente.
//
// `onSessionExpired` avisa a quien escuche (useSessionStore) que el
// refresh fallo y la sesion termino, sin que httpClient importe el store
// (evita el ciclo store -> service -> httpClient -> store).
// ============================================================

let accessToken: string | null = null;
const expiredListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function notifySessionExpired(): void {
  for (const listener of expiredListeners) listener();
}
