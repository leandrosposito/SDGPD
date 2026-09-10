// ============================================================
// lotExpiration — Estado de vencimiento de un lote (Tanda 12).
// Extraido de ProductLotsPanel.tsx para poder ejercitarse con un
// smoke script puro (mismo criterio que shared/utils/tripCapacity.ts/
// orderNumber.ts/patente.ts) y para corregir un hallazgo propio:
// isExpiringSoon usaba Math.abs() sobre la diferencia de tiempo, asi
// que un lote vencido hace 1-29 dias tambien daba isExpiringSoon=true
// (la distancia ABSOLUTA a "hoy" es chica para ambos casos — vencido
// hace poco y por vencer pronto). En el call-site de
// ProductLotsPanel.tsx esto quedaba enmascarado porque `isExpired` se
// chequea PRIMERO y corta con un `return` — pero la funcion en si
// era incorrecta, no solo "correcta por casualidad de orden".
//
// Con la resta SIN Math.abs(), diffDays da negativo para un lote ya
// vencido — isExpiringSoon ahora exige diffDays >= 0 (todavia no
// vencio) ademas de <= 30, asi que "vencidos aparte" es una garantia
// de la funcion misma, no del orden en que se la llama.
// ============================================================

const EXPIRING_SOON_WINDOW_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntil(expirationDate: string, now: Date): number {
  const exp = new Date(expirationDate);
  return Math.ceil((exp.getTime() - now.getTime()) / MS_PER_DAY);
}

export function isExpired(expirationDate: string, now: Date = new Date()): boolean {
  return new Date(expirationDate).getTime() < now.getTime();
}

export function isExpiringSoon(expirationDate: string, now: Date = new Date()): boolean {
  const diffDays = daysUntil(expirationDate, now);
  return diffDays >= 0 && diffDays <= EXPIRING_SOON_WINDOW_DAYS;
}
