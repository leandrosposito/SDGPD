// ============================================================
// toLocalDateString — unico helper de fecha-sin-hora LOCAL del
// proyecto (Fase 0.2 de la corrida completa, AUDIT_11_FECHAS_ZONA_HORARIA.md
// hallazgo #1). Usa los componentes locales del Date (getFullYear/
// getMonth/getDate), nunca `date.toISOString().split('T')[0]`:
// toISOString() convierte a UTC antes de cortar la fecha, y en
// cualquier zona horaria con offset negativo (Argentina, UTC-3, el
// mercado implicito del proyecto) eso da la fecha de MANANA en vez de
// HOY durante las ultimas horas del dia local.
//
// Cualquier prellenado de un <input type="date"> o cualquier
// comparacion de "hoy" contra un dato de negocio debe pasar por aca
// (o por `todayLocalDateString()`), nunca reinventar
// `new Date().toISOString().split('T')[0]`.
// ============================================================

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}
