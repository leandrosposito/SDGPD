import { createHash, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'
import { APP_CONFIG, type AppConfig } from '../config/config.ts'

/**
 * Access token (ADR-BE-003, sub-decisión 2): JWT HS256 de 15 minutos. Claims: `sub` (usuario), `emp`
 * (empresa), `rol` (rol), `ver` (permissions_version) y `sid` (familia de refresh del login, para que
 * el logout la revoque aunque la cookie no viaje a /auth/logout). La verificación fija el algoritmo:
 * `alg: none` y cualquier otro algoritmo se rechazan.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const ALGORITHM = 'HS256'
const ISSUER = 'sdgpd'
const AUDIENCE = 'sdgpd-api'

const claimsSchema = z.object({
  sub: z.uuid(),
  emp: z.uuid(),
  rol: z.uuid(),
  ver: z.int().min(1),
  sid: z.uuid(),
})
export type AccessClaims = z.infer<typeof claimsSchema>

@Injectable()
export class TokenService {
  private readonly key: Uint8Array

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.key = config.auth.jwtSecret
  }

  async issue(claims: AccessClaims): Promise<{ accessToken: string; expiresAt: string }> {
    const now = Math.floor(Date.now() / 1000)
    const exp = now + ACCESS_TOKEN_TTL_SECONDS
    const accessToken = await new SignJWT({ emp: claims.emp, rol: claims.rol, ver: claims.ver, sid: claims.sid })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(this.key)
    return { accessToken, expiresAt: new Date(exp * 1000).toISOString() }
  }

  /** Claims de un token válido (firma, algoritmo, emisor, audiencia, vencimiento), o `null`. */
  async verify(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        requiredClaims: ['exp', 'iat', 'sub'],
      })
      const claims = claimsSchema.safeParse(payload)
      return claims.success ? claims.data : null
    } catch {
      return null
    }
  }
}

/** Refresh token opaco (ADR-BE-003, sub-decisión 3): 32 bytes aleatorios en base64url. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Lo único que se guarda del refresh token: su SHA-256 en hex. */
export function refreshTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** `Authorization: Bearer <token>` → el token, o `undefined`. */
export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header ?? '')
  return match?.[1]
}
