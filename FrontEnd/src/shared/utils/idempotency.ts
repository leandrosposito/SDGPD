// ============================================================
// idempotency — withIdempotency (ADR-010 seccion 4), extraido de
// deliveries.service.ts en Tanda 10B para que trips.service.ts pueda
// usar el mismo mecanismo sin duplicar el mapa clave->resultado ni la
// logica de cacheo.
//
// Mapa clave->resultado en memoria, compartido por TODOS los services
// que lo importen (un solo Map de modulo, no uno por archivo) — ante
// una clave ya vista, el efecto NO se reaplica: se devuelve el
// resultado guardado de la primera vez, tal cual (nunca un error). Sin
// expiracion en este mock (un backend real necesitaria una, ver
// ADR-010 seccion 4 — 24-48hs sugeridas).
//
// Solo se cachea un resultado con `success: true` (fix post-Fase 2 de
// Tanda 9): la clave se genera al ABRIR el modal/formar la intencion
// (antes de saber si la operacion va a poder aplicarse) y sobrevive a
// los reintentos del usuario dentro de esa misma apertura — cachear un
// `success: false` dejaria la clave "congelada" en el fallo para
// siempre, y un segundo intento legitimo (ej. el estado ya cambio a
// uno valido) recibiria de vuelta el mismo fallo viejo en vez de
// ejecutarse. `compute` puede ser async.
// ============================================================

const idempotencyStore = new Map<string, unknown>();

export async function withIdempotency<T extends { success: boolean }>(
  idempotencyKey: string,
  compute: () => T | Promise<T>
): Promise<T> {
  if (idempotencyStore.has(idempotencyKey)) {
    return idempotencyStore.get(idempotencyKey) as T;
  }
  const result = await compute();
  if (result.success) {
    idempotencyStore.set(idempotencyKey, result);
  }
  return result;
}
