import type { ServerResponse } from 'node:http'
import { Body, Controller, Get, Headers, HttpCode, Post, Res } from '@nestjs/common'
import {
  type AccessTokenResponse,
  type AuthErrorCode,
  type LoginRequest,
  type LoginResponse,
  loginRequestSchema,
  type Session,
} from '@sdgpd/contracts'
import type { Principal } from '../db/auth-store.ts'
import { ForbiddenError, UnauthenticatedError } from '../http/errors.ts'
import { ZodValidationPipe } from '../http/zod-validation.pipe.ts'
import { CurrentPrincipal } from './auth.guard.ts'
import { AuthService } from './auth.service.ts'
import { clearedRefreshCookie, readRefreshCookie, refreshCookie } from './refresh-cookie.ts'
import { Public, SessionOnly } from './route-policy.ts'
import { bearerToken } from './tokens.ts'

/**
 * `/auth/*` (ADR-BE-003, sub-decisión 1). Exento de idempotencia y de la transacción de comando
 * (ADR-BE-005, objeción 1): CommandInterceptor no lo toca. Las respuestas nunca llevan el refresh
 * token en el body (rama web): va solo en la cookie.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Public()
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<LoginResponse> {
    const issued = await this.auth.login(body)
    res.setHeader('Set-Cookie', refreshCookie(issued.refreshToken))
    return issued.body
  }

  /** CSRF (sub-decisión 4): exige X-Requested-With; la cookie es SameSite=Strict y solo viaja acá. */
  @Post('refresh')
  @HttpCode(200)
  @Public()
  async refresh(
    @Headers('x-requested-with') requestedWith: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<AccessTokenResponse> {
    if (requestedWith === undefined || requestedWith.trim() === '') {
      throw new ForbiddenError('csrf-header-required' satisfies AuthErrorCode, 'POST /auth/refresh exige el header X-Requested-With')
    }
    const token = readRefreshCookie(cookie)
    try {
      if (token === undefined) throw new UnauthenticatedError()
      const issued = await this.auth.refresh(token)
      res.setHeader('Set-Cookie', refreshCookie(issued.refreshToken))
      return issued.body
    } catch (err) {
      if (err instanceof UnauthenticatedError) res.setHeader('Set-Cookie', clearedRefreshCookie())
      throw err
    }
  }

  @Post('logout')
  @HttpCode(204)
  @Public()
  async logout(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(cookie), bearerToken(authorization))
    res.setHeader('Set-Cookie', clearedRefreshCookie())
  }

  @Get('session')
  @SessionOnly()
  session(@CurrentPrincipal() principal: Principal): Promise<Session> {
    return this.auth.currentSession(principal)
  }
}
