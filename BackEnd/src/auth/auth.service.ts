import { Injectable } from '@nestjs/common'
import type { AccessTokenResponse, LoginRequest, LoginResponse, Session } from '@sdgpd/contracts'
import { AuthStore, type Principal } from '../db/auth-store.ts'
import { Database } from '../db/database.ts'
import { InvalidCredentialsError, NotImplementedError, UnauthenticatedError } from '../http/errors.ts'
import { burnPasswordCheck, verifyPassword } from './passwords.ts'
import { newRefreshToken, refreshTokenHash, TokenService } from './tokens.ts'

/** Resultado de login/refresh: lo que va al body y el refresh token nuevo, que va a la cookie. */
export type IssuedSession<Body> = { body: Body; refreshToken: string }

/** Login, refresh, logout y sesión (ADR-BE-003 §Decisión 1-3, sub-decisiones 1-4). */
@Injectable()
export class AuthService {
  constructor(
    private readonly database: Database,
    private readonly store: AuthStore,
    private readonly tokens: TokenService,
  ) {}

  /**
   * POST /auth/login. Email inexistente, contraseña incorrecta, usuario inactivo y usuario bloqueado
   * responden igual (401 `invalid-credentials`) y tardan lo mismo (BE-1b): siempre se verifica un
   * hash (con un email inexistente, uno ficticio con los mismos parámetros) y siempre hay las mismas dos
   * transacciones de base que con una contraseña incorrecta (estado del bloqueo y registro del fallo).
   * Solo una contraseña incorrecta suma un intento fallido; también durante el bloqueo, así que seguir
   * probando lo vuelve a bloquear.
   */
  async login(request: LoginRequest): Promise<IssuedSession<LoginResponse>> {
    if (request.clientType === 'native') {
      throw new NotImplementedError('El login de la app nativa todavía no está implementado (ADR-BE-003, objeción 1)')
    }
    const candidate = await this.database.findLoginUser(request.email)
    if (candidate === null) {
      await this.store.simulateLoginLookups()
      await burnPasswordCheck(request.password)
      throw new InvalidCredentialsError()
    }
    const locked = await this.store.isLocked(candidate.empresaId, candidate.id)
    const valid = await verifyPassword(candidate.passwordHash, request.password)
    if (!valid) {
      await this.store.registerLoginFailure(candidate.empresaId, candidate.id)
      throw new InvalidCredentialsError()
    }
    if (locked || !candidate.active) throw new InvalidCredentialsError()
    await this.store.clearLoginFailures(candidate.empresaId, candidate.id)

    const principal = await this.store.loadPrincipal(candidate.empresaId, candidate.id)
    if (principal === null || !principal.active) throw new InvalidCredentialsError()
    const refreshToken = newRefreshToken()
    const familyId = await this.store.startRefreshFamily(principal.empresaId, principal.userId, refreshTokenHash(refreshToken))
    const access = await this.accessToken(principal, familyId)
    return { body: { ...access, session: await this.currentSession(principal) }, refreshToken }
  }

  /**
   * POST /auth/refresh: rota el refresh token. Un token ya usado revoca la familia entera (reuso); un
   * token inválido, vencido o revocado, o un usuario inactivo: 401.
   */
  async refresh(refreshToken: string): Promise<IssuedSession<AccessTokenResponse>> {
    const next = newRefreshToken()
    const rotation = await this.store.rotateRefreshToken(refreshTokenHash(refreshToken), refreshTokenHash(next))
    if (rotation.kind !== 'rotated') throw new UnauthenticatedError()
    const principal = await this.store.loadPrincipal(rotation.empresaId, rotation.userId)
    if (principal === null || !principal.active) throw new UnauthenticatedError()
    return { body: await this.accessToken(principal, rotation.familyId), refreshToken: next }
  }

  /**
   * POST /auth/logout: revoca la familia del refresh. La cookie solo viaja a /auth/refresh (su Path),
   * así que la familia sale de la cookie si llega, o del claim `sid` del access token si no.
   */
  async logout(refreshToken: string | undefined, accessToken: string | undefined): Promise<void> {
    if (refreshToken !== undefined) await this.store.revokeFamilyOfToken(refreshTokenHash(refreshToken))
    if (accessToken !== undefined) {
      const claims = await this.tokens.verify(accessToken)
      if (claims !== null) await this.store.revokeFamilyOfUser(claims.emp, claims.sub, claims.sid)
    }
  }

  /** GET /auth/session. */
  async currentSession(principal: Principal): Promise<Session> {
    const data = await this.store.loadSession(principal.empresaId, principal.userId)
    if (data === null) throw new UnauthenticatedError()
    return data
  }

  private async accessToken(principal: Principal, familyId: string): Promise<AccessTokenResponse> {
    const { accessToken, expiresAt } = await this.tokens.issue({
      sub: principal.userId,
      emp: principal.empresaId,
      rol: principal.roleId,
      ver: principal.permissionsVersion,
      sid: familyId,
    })
    return { accessToken, tokenType: 'Bearer', expiresAt }
  }
}
