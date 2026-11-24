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
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayLocalDateString(): string {
  return toLocalDateString(new Date())
}

// ¿La fecha cae dentro del rango [dateFrom, dateTo]? Ambos limites son
// opcionales (filtro inactivo si no vienen) y se comparan contra la porcion
// yyyy-MM-dd de `dateISO`, asi que sirve igual para una fecha pura que para
// un ISO datetime: una orden creada hoy a cualquier hora cae en un rango cuyo
// `dateTo` es hoy.
export function isWithinDateRange(
  dateISO: string,
  dateFrom: string | undefined,
  dateTo: string | undefined
): boolean {
  const day = dateISO.slice(0, 10)
  if (dateFrom && day < dateFrom) return false
  if (dateTo && day > dateTo) return false
  return true
}
