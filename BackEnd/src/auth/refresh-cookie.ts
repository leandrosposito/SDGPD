/**
 * Cookie del refresh token, rama web (ADR-BE-003 §Decisión 1, sub-decisión 3): HttpOnly, Secure,
 * SameSite=Strict, Path=/api/auth/refresh (con el prefijo global, BE-1b). Se lee del header Cookie a
 * mano (sin dependencias).
 */
export const REFRESH_COOKIE_NAME = 'sdgpd_refresh'
export const REFRESH_COOKIE_PATH = '/api/auth/refresh'
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const ATTRIBUTES = `Path=${REFRESH_COOKIE_PATH}; HttpOnly; Secure; SameSite=Strict`

/** `Set-Cookie` con el refresh token nuevo. */
export function refreshCookie(token: string): string {
  return `${REFRESH_COOKIE_NAME}=${token}; ${ATTRIBUTES}; Max-Age=${MAX_AGE_SECONDS}`
}

/** `Set-Cookie` que borra la cookie (mismo Path, Max-Age=0). */
export function clearedRefreshCookie(): string {
  return `${REFRESH_COOKIE_NAME}=; ${ATTRIBUTES}; Max-Age=0`
}

/** El valor de la cookie del refresh en un header Cookie (`a=1; sdgpd_refresh=…`), o `undefined`. */
export function readRefreshCookie(header: string | undefined): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(';')) {
    const pair = part.trim()
    const eq = pair.indexOf('=')
    if (eq <= 0 || pair.slice(0, eq) !== REFRESH_COOKIE_NAME) continue
    const value = pair.slice(eq + 1)
    return /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : undefined
  }
  return undefined
}
